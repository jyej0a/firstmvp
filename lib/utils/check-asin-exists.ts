/**
 * @file lib/utils/check-asin-exists.ts
 * @description ASIN 중복 체크 유틸리티
 * 
 * DB에 이미 존재하는 ASIN인지 확인하는 함수
 * 수집 전에 중복을 체크하여 불필요한 수집 비용을 절감합니다.
 */

import { getServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * ASIN이 DB에 이미 존재하는지 확인
 * 
 * @param asin - 확인할 ASIN
 * @returns 존재 여부 (true: 이미 존재, false: 존재하지 않음)
 */
export async function checkAsinExists(
  asin: string
): Promise<boolean> {
  if (!asin || asin.length < 10) {
    return false; // 유효하지 않은 ASIN은 false 반환
  }

  try {
    const supabase = getServiceRoleClient();
    
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('asin', asin)
      .single();

    // 에러가 없고 데이터가 있으면 이미 존재
    return !error && data !== null;
  } catch (err) {
    console.error('ASIN 중복 체크 오류:', err);
    // 에러 발생 시 안전하게 false 반환 (수집 진행)
    return false;
  }
}

/**
 * 여러 ASIN을 한 번에 확인 (배치 체크)
 * 
 * @param asins - 확인할 ASIN 배열
 * @returns 존재하는 ASIN Set
 */
export async function checkAsinsExist(
  asins: string[]
): Promise<Set<string>> {
  if (asins.length === 0) {
    return new Set();
  }

  try {
    const supabase = getServiceRoleClient();
    
    const { data, error } = await supabase
      .from('products')
      .select('asin')
      .in('asin', asins);

    if (error) {
      console.error('ASIN 배치 체크 오류:', error);
      return new Set();
    }

    // 존재하는 ASIN들을 Set으로 반환
    return new Set((data || []).map((row: { asin: string }) => row.asin));
  } catch (err) {
    console.error('ASIN 배치 체크 오류:', err);
    return new Set();
  }
}

