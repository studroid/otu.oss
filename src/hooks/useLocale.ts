'use client';

import { useLingui } from '@lingui/react';
import type { Locale } from '@/functions/constants';

/**
 * 현재 활성화된 로케일을 반환하는 훅
 * next-intl의 useLocale 대체
 */
export function useLocale(): Locale {
    const { i18n } = useLingui();
    const locale = i18n.locale;
    if (locale === 'ko' || locale === 'en') {
        return locale;
    }
    return 'ko';
}
