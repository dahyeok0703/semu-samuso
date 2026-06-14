-- ============================================================================
-- 0013_storage_hardening
-- 출시 전 보안 하드닝: documents 버킷에 파일 크기·MIME 타입 제한을 강제한다.
-- (앱단 검증 src/lib/security/upload.ts 와 동일한 정책을 스토리지에서 이중 강제)
-- 버킷은 0007 에서 이미 private(public=false) 이며 객체 경로 RLS 로 워크스페이스
-- 격리됨. 여기서는 업로드 가능한 타입/용량만 좁힌다.
--
-- 방어적 적용: 일부 환경(로컬 테스트 셰임)의 storage.buckets 에는
-- file_size_limit/allowed_mime_types 컬럼이 없을 수 있으므로, 컬럼이 존재할 때만
-- 동적으로 UPDATE 한다(실제 Supabase 에는 항상 존재).
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    execute $u$
      update storage.buckets
      set
        file_size_limit = 20971520, -- 20 MB
        allowed_mime_types = array[
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/gif'
        ]
      where id = 'documents'
    $u$;
  end if;
end
$$;
