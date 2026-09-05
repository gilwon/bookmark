// 루트 404 — 없는 주소
import { RecoveryPanel } from "@/components/recovery-panel";

export default function NotFound() {
  return (
    <RecoveryPanel
      title="페이지를 찾을 수 없습니다"
      description="주소가 바뀌었거나 삭제된 페이지입니다."
    />
  );
}
