// db.js
import errorResponse, { successResponse } from '@/functions/response';
import { createClient } from '@/supabase/utils/server';
import { cookies } from 'next/headers';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import { parseLocaleFromAcceptLanguage } from '@/functions/constants';
// export const runtime = "edge";

export async function GET(req: Request) {
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const i18n = await getServerI18n(locale);
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    // @ts-ignore
    if (!user || !user.id) {
        return errorResponse(
            {
                status: 500,
                errorCode: 'NO_USER_INFO',
                data: {},
                meta: {},
                message: i18n._(msg`로그인이 필요합니다. 사용자 정보를 찾지 못했습니다.`),
            },
            new Error()
        );
    }

    let user_id = user.id;

    const { data: page, error } = await supabase
        .from('page')
        .select('id, title, body, is_public, last_viewed_at, created_at, updated_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: true })
        .limit(5000);

    if (error) {
        return errorResponse(
            {
                status: 500,
                errorCode: 'DATABASE_ERROR',
                data: {},
                meta: {},
                message: i18n._(msg`데이터를 가져오는 중 오류가 발생했습니다.`),
            },
            error
        );
    }

    return successResponse({
        message: 'success',
        data: page ? page : [],
        meta: {},
    });
}
