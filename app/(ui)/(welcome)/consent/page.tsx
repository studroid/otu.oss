import s from '@/components/layout/bottom/agreement/docs/docDialog.module.css';
import { getUserLocale } from '@/i18n-server';

export default async function Page() {
    const locale = await getUserLocale();

    const [{ termsOfService }, { privacyPolicy }, { marketing }] = await Promise.all([
        import(`@/components/layout/bottom/agreement/docs/${locale}/terms-of-service_2024_6_20`),
        import(`@/components/layout/bottom/agreement/docs/${locale}/privacy-policy_2024_6_20`),
        import(`@/components/layout/bottom/agreement/docs/${locale}/marketing_2024_6_20`),
    ]);

    return (
        <div className={s.root}>
            <div id="terms-of-service" className="">
                <h2 className="text-xl font-semibold mb-4">{termsOfService.title}</h2>
                <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: termsOfService.body }}
                ></div>
            </div>
            <div id="privacy-policy" className="">
                <h2 className="text-xl font-semibold mb-4">{privacyPolicy.title}</h2>
                <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: privacyPolicy.body }}
                ></div>
            </div>
        </div>
    );
}
