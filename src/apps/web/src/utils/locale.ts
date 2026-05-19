/** Map i18n language code to BCP 47 locale for dates/numbers */
export function getDateLocale(lang: string): string {
  switch (lang) {
    case 'zh':
      return 'zh-CN'
    case 'fr':
      return 'fr-FR'
    default:
      return 'en-US'
  }
}
