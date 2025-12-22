/**
 * @file lib/utils/image-deduplicator.ts
 * @description 이미지 URL 중복 제거 유틸리티
 * 
 * 아마존 이미지 URL의 해상도 파라미터를 제거하여
 * 같은 이미지의 다른 해상도 버전을 중복으로 인식하고 제거합니다.
 */

/**
 * 이미지 URL 정규화 (중복 제거용)
 * 
 * 아마존 이미지 URL 패턴:
 * - ..._AC_SL1500_.jpg (해상도 1500)
 * - ..._AC_SL1000_.jpg (해상도 1000)
 * - ..._AC_US40_.jpg (썸네일)
 * - ..._AC_SR100,100_.jpg (크기 지정)
 * 
 * 이들을 모두 ..._AC_.jpg로 정규화하여 같은 이미지로 인식
 * 
 * @param url - 이미지 URL
 * @returns 정규화된 URL
 */
function normalizeImageUrl(url: string): string {
  if (!url) return url;
  
  // 쿼리 파라미터 제거
  let normalized = url.split('?')[0];
  
  // 아마존 이미지 URL 패턴 정규화
  // 해상도 파라미터 제거하여 같은 이미지로 인식
  normalized = normalized.replace(/_AC_SL\d+_/g, '_AC_');
  normalized = normalized.replace(/_AC_US\d+_/g, '_AC_');
  normalized = normalized.replace(/_AC_SR\d+,\d+_/g, '_AC_');
  normalized = normalized.replace(/_AC_UL\d+_/g, '_AC_');
  
  return normalized;
}

/**
 * 이미지 배열에서 중복 제거
 * 
 * 같은 이미지의 다른 해상도 버전을 중복으로 인식하여 제거합니다.
 * 원본 URL은 유지하되, 정규화된 URL을 기준으로 중복을 판단합니다.
 * 
 * @param images - 이미지 URL 배열
 * @returns 중복 제거된 이미지 URL 배열
 * 
 * @example
 * const images = [
 *   'https://..._AC_SL1500_.jpg',
 *   'https://..._AC_SL1000_.jpg',  // 중복 (같은 이미지)
 *   'https://..._AC_SL500_.jpg',   // 중복 (같은 이미지)
 *   'https://..._AC_SL800_.jpg'    // 다른 이미지
 * ];
 * 
 * deduplicateImages(images);
 * // Returns: [
 * //   'https://..._AC_SL1500_.jpg',  // 첫 번째 것만 유지
 * //   'https://..._AC_SL800_.jpg'
 * // ]
 */
export function deduplicateImages(images: string[]): string[] {
  if (!images || images.length === 0) return [];
  
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const url of images) {
    if (!url) continue;
    
    const normalized = normalizeImageUrl(url);
    
    // 정규화된 URL이 이미 있으면 스킵 (중복)
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url); // 원본 URL 유지 (가장 먼저 나온 것)
    }
  }
  
  return unique;
}

