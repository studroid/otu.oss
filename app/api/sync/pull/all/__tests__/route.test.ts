/**
 * @jest-environment node
 */
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/supabase/utils/server';

// Mock dependencies
jest.mock('@/supabase/utils/server', () => ({
    createClient: jest.fn(),
}));

jest.mock('@/debug/sync', () => ({
    syncLogger: jest.fn(),
}));

// Mock constants to control test flow
jest.mock('@/functions/constants', () => ({
    TARGET_SIZE: 1000, // 1KB for easy testing
    MAX_LIMIT: 10, // Small limit for easy testing
}));

describe('GET /api/sync/pull/all', () => {
    let mockSupabase: any;
    const originalConsoleError = console.error;

    beforeEach(() => {
        jest.clearAllMocks();
        // console.error를 mock하여 테스트 중 출력 방지
        console.error = jest.fn();

        // Default Supabase mock setup
        mockSupabase = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: { id: 'test-user-id' } },
                    error: null,
                }),
            },
            rpc: jest.fn().mockResolvedValue({ data: { pages: [], hasMore: false }, error: null }),
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    afterEach(() => {
        // console.error 복원
        console.error = originalConsoleError;
    });

    const createMockRequest = (url: string) => {
        return new NextRequest(new URL(url, 'http://localhost'));
    };

    it('should return 401 if user is not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Auth error' },
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);

        expect(res.status).toBe(401);
    });

    it('should return 400 if invalid cursor params are provided (only created_at)', async () => {
        const req = createMockRequest('/api/sync/pull/all?created_at=2023-01-01');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid cursor');
    });

    it('should return 400 if invalid cursor params are provided (only last_id)', async () => {
        const req = createMockRequest('/api/sync/pull/all?last_id=abc');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid cursor');
    });

    it('should return 400 if created_at format is invalid', async () => {
        const req = createMockRequest('/api/sync/pull/all?created_at=invalid-date&last_id=abc');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid created_at format');
    });

    it('should fetch data successfully with valid params', async () => {
        const mockPages = [{ id: '1', created_at: '2023-01-01T00:00:00Z', length: 100 }];
        const mockFolders = [{ id: 'folder-1', name: 'Test Folder' }];
        const mockAlarms = [{ id: 'alarm-1', page_id: '1' }];

        // JSON 형식의 RPC 반환값 모킹
        mockSupabase.rpc.mockResolvedValue({
            data: { pages: mockPages, hasMore: false },
            error: null,
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'folder') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: mockFolders, error: null }),
                };
            }
            if (table === 'alarm') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: mockAlarms, error: null }),
                };
            }
            return mockSupabase;
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.pages).toHaveLength(1);
        expect(body.folders).toHaveLength(1);
        expect(body.alarms).toHaveLength(1);
        expect(body.hasMore).toBe(false);
        expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');

        // RPC 호출 파라미터 검증
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_dynamic_pages_chunk', {
            last_created_at: null,
            last_id: null,
            target_size: 1000,
            max_limit: 10,
        });
    });

    it('should use hasMore from RPC when MAX_LIMIT is reached', async () => {
        // Mock MAX_LIMIT is 10. RPC가 10개 페이지와 hasMore: true를 반환하는 경우
        const mockPages = Array(10)
            .fill(null)
            .map((_, i) => ({
                id: `${i}`,
                created_at: '2023-01-01T00:00:00Z',
                length: 10,
            }));
        // RPC는 { pages, hasMore } 형태의 JSON을 반환함
        mockSupabase.rpc.mockResolvedValue({
            data: { pages: mockPages, hasMore: true },
            error: null,
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(body.pages).toHaveLength(10);
        // hasMore는 RPC에서 반환된 값을 그대로 사용해야 함
        expect(body.hasMore).toBe(true);
    });

    it('should use hasMore from RPC response', async () => {
        const mockPages = [{ id: '1', created_at: '2023-01-01', length: 100 }];
        // hasMore: true로 모킹
        mockSupabase.rpc.mockResolvedValue({
            data: { pages: mockPages, hasMore: true },
            error: null,
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(body.hasMore).toBe(true);
    });

    it('should use hasMore from RPC response (false case)', async () => {
        const mockPages = [{ id: '1', created_at: '2023-01-01', length: 100 }];
        // hasMore: false로 모킹
        mockSupabase.rpc.mockResolvedValue({
            data: { pages: mockPages, hasMore: false },
            error: null,
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(body.hasMore).toBe(false);
    });

    it('should handle RPC errors gracefully', async () => {
        mockSupabase.rpc.mockResolvedValue({
            data: null,
            error: { message: 'RPC Error', code: 'P0001' },
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('Internal Server Error');
    });

    it('should only fetch folders and alarms on first page', async () => {
        const mockPages = [{ id: '1', created_at: '2023-01-01T00:00:00Z', length: 100 }];
        const mockFolders = [{ id: 'folder-1', name: 'Test Folder' }];
        const mockAlarms = [{ id: 'alarm-1', page_id: '1' }];

        mockSupabase.rpc.mockResolvedValue({
            data: { pages: mockPages, hasMore: false },
            error: null,
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'folder') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: mockFolders, error: null }),
                };
            }
            if (table === 'alarm') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: mockAlarms, error: null }),
                };
            }
            return mockSupabase;
        });

        // 첫 페이지 요청
        const firstPageReq = createMockRequest('/api/sync/pull/all');
        const firstPageRes = await GET(firstPageReq);
        const firstPageBody = await firstPageRes.json();

        expect(firstPageBody.folders).toHaveLength(1);
        expect(firstPageBody.alarms).toHaveLength(1);

        // 후속 페이지 요청 (커서 포함)
        const nextPageReq = createMockRequest(
            '/api/sync/pull/all?created_at=2023-01-01T00:00:00Z&last_id=1'
        );
        const nextPageRes = await GET(nextPageReq);
        const nextPageBody = await nextPageRes.json();

        expect(nextPageBody.folders).toHaveLength(0);
        expect(nextPageBody.alarms).toHaveLength(0);
    });

    it('should generate timestamp when no data exists on first page', async () => {
        mockSupabase.rpc.mockResolvedValue({
            data: { pages: [], hasMore: false },
            error: null,
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'folder' || table === 'alarm') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return mockSupabase;
        });

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.pages).toHaveLength(0);
        expect(body.hasMore).toBe(false);
        // 데이터가 없을 때는 커서 일관성을 위해 둘 다 null이어야 함
        expect(body.created_at).toBeNull();
        expect(body.lastId).toBeNull();
    });

    it('should handle RPC returning null pages gracefully', async () => {
        // pages가 null인 경우 처리
        mockSupabase.rpc.mockResolvedValue({
            data: { pages: null, hasMore: false },
            error: null,
        });

        mockSupabase.from.mockImplementation(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }));

        const req = createMockRequest('/api/sync/pull/all');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.pages).toHaveLength(0);
        expect(body.hasMore).toBe(false);
        // 데이터가 없을 때는 커서 일관성을 위해 둘 다 null이어야 함 (첫 페이지인 경우)
        expect(body.created_at).toBeNull();
        expect(body.lastId).toBeNull();
    });
});
