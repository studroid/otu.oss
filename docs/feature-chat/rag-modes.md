# AI 채팅 RAG 모드

## 개요

AI 채팅에서 사용자 질문에 대한 컨텍스트를 제공하기 위해 3가지 RAG (Retrieval-Augmented Generation) 모드를 지원합니다. 사용자는 입력창 상단의 Select 메뉴에서 검색 범위를 선택하여 AI가 참조할 문서 범위를 제어할 수 있습니다.

## RAG 모드 종류

### 1. none (검색 안 함)

- **동작**: 참조 문서 없이 AI와 대화
- **용도**: 일반적인 질문이나 대화
- **특징**: 가장 빠른 응답 속도

### 2. all (전체 검색)

- **동작**: 사용자의 모든 페이지에서 벡터 유사도 검색 수행
- **용도**: 광범위한 참조가 필요한 질문
- **특징**: 가장 정확한 컨텍스트 제공

### 3. current (현재 페이지)

- **동작**: 현재 열려있는 페이지만 참조
- **용도**: 특정 페이지 내용에 대한 질문
- **특징**: 페이지 컨텍스트 기반 대화

## 처리 흐름

### 1. 사용자 질문 입력

1. 입력창에서 질문 작성
2. RAG 모드 선택 (none/all/current)
3. 전송 버튼 클릭

### 2. Similarity 검색 (mode ≠ none)

**API 엔드포인트**: `/api/ai/similaritySearch`

**요청 구조**:

```typescript
{
  inputMessage: string,      // 사용자 질문
  page_id?: string,          // current 모드인 경우
  count?: number,            // 검색 결과 개수 (기본값: 3, 최대: 10)
  threshold?: number         // 유사도 임계값 (기본값: 0.55)
}
```

**응답 구조**:

```typescript
{
    data: Array<{
        id: string;
        content: string;
        metadata: {
            type: string;
            title: string;
        };
        similarity: number;
        page_id: string;
    }>;
}
```

**검색 프로세스**:

1. 사용자 질문을 임베딩 (개발: OpenAI, 프로덕션: Vercel AI Gateway)
2. PostgreSQL `match_documents` 함수 호출
3. 벡터 유사도 계산 (Cosine Similarity)
4. 유사도 0.55 이상 결과만 반환
5. 유사도 내림차순 정렬

### 3. 검색 결과 표시

**UI 컴포넌트**: `SimilarityEndMessage`

- 유사도 기반으로 정렬된 페이지 목록 표시
- 각 항목은 페이지 링크로 이동 가능
- 검색 결과가 없으면 특수 처리 (아래 참고)

### 4. AI에게 전달

**API 엔드포인트**: `/api/ai/askLLM/${provider}`

**요청 구조**:

```typescript
{
  message: string,
  references: similarityResponse[],
  contextMessages: contextMessage[]
}
```

AI는 검색된 참조 문서를 컨텍스트로 받아 답변을 생성합니다.

## 특수 케이스: Current 모드에서 검색 결과 없음

### 케이스 1: 짧은 페이지

**조건**: 페이지 길이가 `RAG_SEARCH_MIN_LENGTH_THRESHOLD` (600자) 미만

**동작**: 즉시 현재 페이지 전체를 참조로 사용

**이유**: 짧은 페이지는 임베딩 검색 없이도 전체 내용을 컨텍스트로 제공 가능

### 케이스 2: 검색 결과 없음

**조건**: 벡터 검색 결과가 없는 경우

**동작**: 현재 페이지 본문을 600자로 잘라서 참조로 사용

**이유**: 최소한의 페이지 컨텍스트를 제공하여 대화 연속성 유지

## 관련 파일

### UI 컴포넌트

- **입력창**: `src/components/Chat/Root/Input/view.tsx`
    - RAG 모드 Select 컴포넌트
- **검색 결과**: `src/components/Chat/Root/Conversation/index.tsx`
    - `SimilarityEndMessage` 컴포넌트
- **AI 응답**: `LLMResponseMessage` 컴포넌트

### API 라우트

- **검색**: `app/api/ai/similaritySearch/route.tsx`
- **AI 응답**: `app/api/ai/askLLM/openai/route.tsx`

### 로직

- **채팅 프로세스**: `src/components/Chat/Root/Input/useChatProcess.tsx`
    - `getSimilarity()` 함수
    - `askLLM()` 함수

### 타입 정의

- **전역 상태**: `src/lib/jotai.ts`
    - `similarityResponse` 타입
    - `contextMessage` 타입

## 관련 문서

- **임베딩 생성**: 페이지 저장 시 OpenAI API (개발) 또는 Vercel AI Gateway (프로덕션)를 통해 텍스트를 벡터로 변환하여 PostgreSQL에 저장합니다. 이 벡터는 RAG 검색 시 유사도 계산에 사용됩니다.
