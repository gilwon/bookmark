// 인증 영역 404. 위 레이아웃(사이드바)은 유지한다.
import { RecoveryPanel } from "@/components/recovery-panel";

export default function AppNotFound() {
  return (
    <RecoveryPanel
      title="페이지를 찾을 수 없습니다"
      description="주소가 바뀌었거나 삭제된 페이지입니다."
    />
  );
}
