# 인증 테스트 계획

## 개요

OTU 앱의 인증 시스템 테스트 계획입니다. Supabase Auth 기반으로 Google, GitHub, Apple, Email 로그인을 지원합니다.

## 테스트 시나리오

### 1. 보호된 경로 리디렉션

**Seed:** `e2e/seed.spec.ts`

#### 1.1 비로그인 시 홈 접근 차단

**Steps:**

1. 브라우저에서 `/home` 경로로 직접 이동
2. 페이지 로드 완료 대기

**Expected Results:**

- URL이 `/signin`으로 변경됨
- `redirectTo` 쿼리 파라미터에 원래 경로가 포함됨

#### 1.2 비로그인 시 에디터 접근 차단

**Steps:**

1. 브라우저에서 `/home/page/[임의ID]` 경로로 직접 이동
2. 페이지 로드 완료 대기

**Expected Results:**

- URL이 `/signin`으로 변경됨

### 2. 이메일 로그인

**Seed:** `e2e/seed.spec.ts`

#### 2.1 유효한 이메일로 로그인

**Steps:**

1. `/signin` 페이지로 이동
2. 이메일 입력 필드에 테스트 계정 이메일 입력
3. 패스워드 입력 필드에 테스트 계정 비밀번호 입력
4. 로그인 버튼 클릭
5. 페이지 전환 대기

**Expected Results:**

- 로그인 성공 후 `/home` 페이지로 리디렉션
- 사용자 정보가 표시됨

#### 2.2 잘못된 이메일 형식

**Steps:**

1. `/signin` 페이지로 이동
2. 이메일 입력 필드에 "invalid-email" 입력
3. 패스워드 입력 필드에 "password" 입력
4. 로그인 버튼 클릭

**Expected Results:**

- 에러 메시지 표시 (이메일 형식 오류)
- 로그인 페이지 유지

#### 2.3 잘못된 비밀번호

**Steps:**

1. `/signin` 페이지로 이동
2. 이메일 입력 필드에 유효한 이메일 입력
3. 패스워드 입력 필드에 잘못된 비밀번호 입력
4. 로그인 버튼 클릭

**Expected Results:**

- 에러 메시지 표시 (인증 실패)
- 로그인 페이지 유지

### 3. 소셜 로그인 버튼

**Seed:** `e2e/seed.spec.ts`

#### 3.1 Google 로그인 버튼 존재 확인

**Steps:**

1. `/signin` 페이지로 이동
2. Google 로그인 버튼 검색

**Expected Results:**

- Google 로그인 버튼이 화면에 표시됨
- 버튼이 클릭 가능한 상태

#### 3.2 GitHub 로그인 버튼 존재 확인

**Steps:**

1. `/signin` 페이지로 이동
2. GitHub 로그인 버튼 검색

**Expected Results:**

- GitHub 로그인 버튼이 화면에 표시됨
- 버튼이 클릭 가능한 상태

### 4. 로그아웃

**Seed:** `e2e/seed.spec.ts` (로그인 상태 필요)

#### 4.1 로그아웃 실행

**Steps:**

1. 로그인 상태로 `/home` 페이지에 접근
2. 사용자 메뉴 열기
3. 로그아웃 버튼 클릭

**Expected Results:**

- 세션 종료
- `/signin` 페이지로 리디렉션
- 로컬 스토리지의 인증 정보 삭제

## 테스트 환경

- 테스트 계정: 로컬 Supabase 기본 계정 사용
- Base URL: `http://127.0.0.1:3000`
