import { useLocale } from '../i18n/LocaleContext'

interface DateLabelProps {
  htmlFor: string
}

export function DateLabel({ htmlFor }: DateLabelProps) {
  const { t } = useLocale()

  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
      {t('dateLabel')}
      <span className="ms-2 font-normal text-gray-500">{t('dateFormatHint')}</span>
    </label>
  )
}
