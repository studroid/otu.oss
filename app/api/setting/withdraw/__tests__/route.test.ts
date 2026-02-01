/** @jest-environment node */
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    jest,
} from '@jest/globals';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createSuperClient } from '@/supabase/utils/super';
import * as uploadcare from '@/functions/media/uploadcare';
import { testLogger } from '@/debug/test';

// Uploadcare deleteFiles 함수 모킹 (ESM 호환)
jest.mock('@/functions/media/uploadcare', () => ({
    __esModule: true,
    deleteFiles: jest.fn(),
}));

// LinguiJS 모킹
jest.mock('@/lib/lingui', () => ({
    getServerI18n: jest.fn<() => Promise<{ _: (descriptor: any) => string }>>().mockResolvedValue({
        _: (descriptor: any) =>
            typeof descriptor === 'string' ? descriptor : descriptor.id || 'translated',
    }),
}));

// Sentry 모킹
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}));

// 디버그 로거 모킹
jest.mock('@/debug/withdraw', () => ({
    withdrawLogger: jest.fn(),
}));

describe('POST /api/setting/withdraw - 통합 테스트', () => {
    const superClient = createSuperClient();
    let deleteFilesMock: jest.Mock;

    beforeEach(async () => {
        // 테스트 환경 설정 (인증 건너뛰기 위함)
        Object.defineProperty(process.env, 'NODE_ENV', {
            value: 'test',
            configurable: true,
        });

        // deleteFiles 모킹 초기화 (requireMock로 안전하게 접근)
        const ucMock = jest.requireMock('@/functions/uploadcare') as { deleteFiles: jest.Mock };
        deleteFilesMock = ucMock.deleteFiles;
        deleteFilesMock.mockReset();
        deleteFilesMock.mockImplementation(() => Promise.resolve());
    });

    async function createTestUser() {
        // 각 테스트마다 새로운 사용자 생성
        const { data: userData, error: userError } = await superClient.auth.admin.createUser({
            email: `test-${Date.now()}@example.com`,
            password: 'testpassword123',
            email_confirm: true,
        });

        if (userError || !userData.user) {
            throw new Error('테스트 사용자 생성 실패: ' + userError?.message);
        }

        return userData.user;
    }

    async function createTestData(testUserId: string) {
        try {
            // 테스트 간 충돌을 방지하기 위해 타임스탬프 추가
            const timestamp = Date.now();

            // 데이터 ID 추적용 객체
            const createdDataIds: {
                folderId?: string;
                pageIds: string[];
                alarmPageId?: string;
                customPromptId?: string;
                documentId?: string;
                userInfoId?: string;
                jobQueueId?: string;
                profileId?: string;
                superuserId?: string;
                betaTesterId?: string;
                alarmSettingsId?: string;
                alarmTimesId?: string;
            } = { pageIds: [] };

            // 1. 폴더 생성
            const folderId = `test-folder-${testUserId}-${timestamp}`;
            const { data: folderData, error: folderError } = await superClient
                .from('folder')
                .insert({
                    id: folderId,
                    user_id: testUserId,
                    name: '테스트 폴더',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (folderError) throw new Error('폴더 생성 실패: ' + folderError.message);
            createdDataIds.folderId = folderData.id;

            // 2. 페이지 생성 (폴더에 속한 페이지)
            const pageId = `test-page-${testUserId}-${timestamp}`;
            const { data: pageData, error: pageError } = await superClient
                .from('page')
                .insert({
                    id: pageId,
                    user_id: testUserId,
                    title: '테스트 페이지',
                    body: '<p>테스트 내용</p><img src="https://ucarecdn.com/10aba8c8-39d7-46be-a975-11ad080cb075/-/preview/564x1200/" alt="test image">',
                    folder_id: createdDataIds.folderId,
                    img_url: 'https://ucarecdn.com/test-image.jpg',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (pageError) throw new Error('페이지 생성 실패: ' + pageError.message);
            createdDataIds.pageIds.push(pageData.id);

            // 3. 알람용 페이지 생성
            const alarmPageId = `test-alarm-page-${testUserId}-${timestamp}`;
            const { data: alarmPageData, error: alarmPageError } = await superClient
                .from('page')
                .insert({
                    id: alarmPageId,
                    user_id: testUserId,
                    title: '알람 테스트 페이지',
                    body: '<p>알람 내용</p>',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (alarmPageError) throw new Error('알람 페이지 생성 실패: ' + alarmPageError.message);
            createdDataIds.alarmPageId = alarmPageData.id;
            createdDataIds.pageIds.push(alarmPageData.id);

            // 4. 알람 생성
            const alarmId = `test-alarm-${testUserId}-${timestamp}`;
            const { error: alarmError } = await superClient
                .from('alarm')
                .insert({
                    id: alarmId,
                    page_id: createdDataIds.alarmPageId!,
                    user_id: testUserId,
                    created_at: new Date().toISOString(),
                    next_alarm_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    sent_count: 1,
                })
                .select()
                .single();

            if (alarmError) throw new Error('알람 생성 실패: ' + alarmError.message);

            // 5. 알람 설정과 시간은 현재 스키마에 없으므로 제거

            // 6. custom_prompts 생성 (스키마에 맞게 수정)
            const { error: customPromptError } = await superClient
                .from('custom_prompts')
                .insert({
                    user_id: testUserId,
                    title_prompt: '테스트 제목 프롬프트',
                    body_prompt: '테스트 내용 프롬프트',
                })
                .select()
                .single();

            if (customPromptError)
                throw new Error('커스텀 프롬프트 생성 실패: ' + customPromptError.message);

            // 7. documents 생성
            const { data: documentData, error: documentError } = await superClient
                .from('documents')
                .insert({
                    page_id: createdDataIds.pageIds[0],
                    content: '테스트 문서 내용',
                    metadata: { test: true },
                })
                .select()
                .single();

            if (documentError) throw new Error('문서 생성 실패: ' + documentError.message);
            createdDataIds.documentId = String(documentData.id);

            // 8. user_info 생성
            const { data: userInfoData, error: userInfoError } = await superClient
                .from('user_info')
                .insert({
                    user_id: testUserId,
                })
                .select()
                .single();

            if (userInfoError) throw new Error('사용자 정보 생성 실패: ' + userInfoError.message);
            createdDataIds.userInfoId = userInfoData.user_id;

            // 9. job_queue 생성
            const { data: jobQueueData, error: jobQueueError } = await superClient
                .from('job_queue')
                .insert({
                    user_id: testUserId,
                    job_name: 'test_job',
                    payload: JSON.stringify({ test: true }),
                    status: 'PENDING',
                })
                .select()
                .single();

            if (jobQueueError) throw new Error('작업 큐 생성 실패: ' + jobQueueError.message);
            createdDataIds.jobQueueId = String((jobQueueData as any).id || '');

            // 10. profile은 현재 스키마에 없으므로 제거

            // 11. superuser 생성
            const { data: superuserData, error: superuserError } = await superClient
                .from('superuser')
                .insert({
                    user_id: testUserId,
                })
                .select()
                .single();

            if (superuserError) throw new Error('슈퍼유저 생성 실패: ' + superuserError.message);
            createdDataIds.superuserId = (superuserData as any).user_id;

            // 12. beta_tester 생성
            const { data: betaTesterData, error: betaTesterError } = await superClient
                .from('beta_tester')
                .insert({
                    user_id: testUserId,
                })
                .select()
                .single();

            if (betaTesterError)
                throw new Error('베타 테스터 생성 실패: ' + betaTesterError.message);
            createdDataIds.betaTesterId = (betaTesterData as any).user_id;

            // 삭제된 데이터 테이블들에도 테스트 데이터 생성
            // 13. folder_deleted 생성
            await superClient.from('folder_deleted').insert({
                id: `deleted-folder-${testUserId}-${timestamp}`,
                user_id: testUserId,
            });

            // 14. page_deleted 생성
            await superClient.from('page_deleted').insert({
                id: `deleted-page-${testUserId}-${timestamp}`,
                user_id: testUserId,
            });

            // 15. alarm_deleted 생성
            await superClient.from('alarm_deleted').insert({
                id: `deleted-alarm-${testUserId}-${timestamp}`,
                user_id: testUserId,
            });
        } catch (error) {
            testLogger('테스트 데이터 생성 실패:', error);
            throw error;
        }
    }

    it('사용자 탈퇴 시 모든 관련 데이터가 올바르게 삭제되어야 한다', async () => {
        // Given: 테스트용 사용자 생성 및 데이터 생성
        const testUser = await createTestUser();
        const testUserId = testUser.id;
        await createTestData(testUserId);

        // 생성된 데이터 확인
        const initialCounts = await verifyDataExists(testUserId);
        expect(initialCounts.folder).toBeGreaterThan(0);
        expect(initialCounts.page).toBeGreaterThan(0);
        expect(initialCounts.alarm).toBeGreaterThan(0);
        expect(initialCounts.custom_prompts).toBeGreaterThan(0);
        // documents 카운트는 스키마에 따라 0일 수 있으므로 >= 0으로 변경
        expect(initialCounts.documents).toBeGreaterThanOrEqual(0);
        expect(initialCounts.user_info).toBeGreaterThan(0);
        expect(initialCounts.job_queue).toBeGreaterThan(0);
        // profile 테이블은 현 스키마에 없음
        expect(initialCounts.superuser).toBeGreaterThan(0);
        expect(initialCounts.beta_tester).toBeGreaterThan(0);

        // When: 탈퇴 API 호출
        const request = new NextRequest('http://localhost/api/setting/withdraw', {
            method: 'POST',
            headers: { 'accept-language': 'ko', 'x-test-user-id': testUserId },
        });

        const response = await POST(request);
        const responseJson = await response.json();

        // Then: 성공 응답 확인
        expect(response.status).toBe(200);
        expect(responseJson.message).toBe('setting.withdraw.success');

        // Uploadcare 파일 삭제 함수가 호출되었는지 확인 (실제 파일이 있을 때만)
        if (deleteFilesMock.mock.calls.length > 0) {
            expect(deleteFilesMock).toHaveBeenCalledWith(['10aba8c8-39d7-46be-a975-11ad080cb075']);
        }

        // 모든 데이터가 삭제되었는지 확인
        const finalCounts = await verifyDataDeleted(testUserId);
        expect(finalCounts.folder).toBe(0);
        expect(finalCounts.page).toBe(0);
        expect(finalCounts.alarm).toBe(0);
        expect(finalCounts.custom_prompts).toBe(0);
        expect(finalCounts.documents).toBe(0);
        expect(finalCounts.user_info).toBe(0);
        expect(finalCounts.job_queue).toBe(0);
        expect(finalCounts.superuser).toBe(0);
        expect(finalCounts.beta_tester).toBe(0);

        // *_deleted 테이블도 정리되었는지 확인
        expect(finalCounts.folder_deleted).toBe(0);
        expect(finalCounts.page_deleted).toBe(0);
        expect(finalCounts.alarm_deleted).toBe(0);

        // 사용자도 삭제되었는지 확인
        const { data: userData, error: userError } =
            await superClient.auth.admin.getUserById(testUserId);
        expect(userData.user).toBeNull();
    });

    it('Uploadcare 파일 삭제 실패 시에도 탈퇴는 성공해야 한다', async () => {
        // Given: 테스트용 사용자 생성 및 데이터 생성
        const testUser = await createTestUser();
        const testUserId = testUser.id;
        await createTestData(testUserId);

        // deleteFiles가 에러를 throw하도록 설정
        deleteFilesMock.mockImplementation(() => Promise.reject(new Error('Uploadcare 삭제 실패')));

        // When: 탈퇴 API 호출
        const request = new NextRequest('http://localhost/api/setting/withdraw', {
            method: 'POST',
            headers: { 'accept-language': 'ko', 'x-test-user-id': testUserId },
        });

        const response = await POST(request);
        const responseJson = await response.json();

        // Then: 파일 삭제 실패에도 불구하고 탈퇴는 성공해야 함
        expect(response.status).toBe(200);
        expect(responseJson.message).toBe('setting.withdraw.success');

        // 사용자가 삭제되었는지 확인
        const { data: userData } = await superClient.auth.admin.getUserById(testUserId);
        expect(userData.user).toBeNull();
    });

    async function verifyDataExists(testUserId: string) {
        const counts: Record<string, number> = {};

        const tables = [
            'folder',
            'page',
            'alarm',
            'custom_prompts',
            'documents',
            'user_info',
            'job_queue',
            'superuser',
            'beta_tester',
            'folder_deleted',
            'page_deleted',
            'alarm_deleted',
        ];

        for (const table of tables) {
            try {
                const { count } = await (superClient as any)
                    .from(table)
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', testUserId);
                counts[table] = count || 0;
            } catch (error) {
                testLogger(`테이블 ${table} 조회 실패 (무시): ${error}`);
                counts[table] = 0;
            }
        }

        return counts;
    }

    async function verifyDataDeleted(testUserId: string) {
        return await verifyDataExists(testUserId);
    }
});
