/**
 * 에러를 콘솔에 로깅합니다.
 * @param msg - 로깅할 에러 메시지 또는 에러 객체
 */
export function reportErrorToSentry(msg: any) {
    const _msg = msg ? msg : 'No Message';
    console.error('Error:', _msg);
}
