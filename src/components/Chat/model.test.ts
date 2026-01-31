/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { aiOptions, DEFAULT_LLM } from './model';

describe('aiOptions - AI 모델 선택 옵션 상수', () => {
    test('최소 하나 이상의 AI 옵션이 있어야 함', () => {
        expect(aiOptions.length).toBeGreaterThan(0);
    });

    test('각 옵션은 필수 필드를 가져야 함', () => {
        aiOptions.forEach((option) => {
            expect(option).toHaveProperty('description');
            expect(option).toHaveProperty('value');
            expect(option).toHaveProperty('displayLabel');
        });
    });

    test('각 옵션의 필수 필드는 비어있지 않은 문자열이어야 함', () => {
        aiOptions.forEach((option) => {
            expect(typeof option.description).toBe('string');
            expect(option.description.length).toBeGreaterThan(0);

            expect(typeof option.value).toBe('string');
            expect(option.value.length).toBeGreaterThan(0);

            expect(typeof option.displayLabel).toBe('string');
            expect(option.displayLabel.length).toBeGreaterThan(0);
        });
    });

    test('현재 모든 옵션에 provider 필드가 있어야 함 (타입은 선택적이지만 런타임 검증)', () => {
        aiOptions.forEach((option) => {
            expect(option.provider).toBeDefined();
            expect(typeof option.provider).toBe('string');
            expect(option.provider?.length).toBeGreaterThan(0);
        });
    });

    test('각 옵션의 value는 고유해야 함 (LLM 선택 시 식별자로 사용)', () => {
        const values = aiOptions.map((option) => option.value);
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(values.length);
    });
});

describe('DEFAULT_LLM - 기본 AI 모델', () => {
    test('DEFAULT_LLM이 aiOptions에 포함되어야 함', () => {
        expect(aiOptions).toContain(DEFAULT_LLM);
    });

    test('DEFAULT_LLM은 aiOptions의 첫 번째 요소여야 함 (UI 기본 선택값)', () => {
        expect(DEFAULT_LLM).toBe(aiOptions[0]);
    });
});
