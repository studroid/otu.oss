import { i18n, setupI18n, type Messages } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { defaultLocale, type Locale } from '@/functions/constants';

// PO extract / compile 없이도 런타임에서 메시지 컴파일 가능하게 설정
// https://github.com/lingui/js-lingui/issues/2295
i18n.setMessagesCompiler(compileMessage);

export function loadCatalog(locale: string, messages: Messages) {
    i18n.load(locale, messages);
    i18n.activate(locale);
}

/**
 * API 라우트 등 서버 사이드에서 독립적인 i18n 인스턴스를 생성합니다.
 * 전역 i18n과 격리되어 동시 요청에서도 안전합니다.
 */
export async function getServerI18n(locale: Locale) {
    try {
        const { messages } = await import(`../locales/${locale}/messages.po`);
        const serverI18n = setupI18n({
            locale,
            messages: { [locale]: messages },
        });
        serverI18n.setMessagesCompiler(compileMessage);
        return serverI18n;
    } catch (error) {
        console.error(
            `Failed to load locale "${locale}", falling back to "${defaultLocale}"`,
            error
        );
        const { messages } = await import(`../locales/${defaultLocale}/messages.po`);
        const serverI18n = setupI18n({
            locale: defaultLocale,
            messages: { [defaultLocale]: messages },
        });
        serverI18n.setMessagesCompiler(compileMessage);
        return serverI18n;
    }
}

export { i18n };
