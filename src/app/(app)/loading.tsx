// (app) 그룹 모든 페이지가 데이터를 불러오는 동안 보이는 목록 스켈레톤
import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function Loading() {
  return <ListSkeleton rows={8} className="mx-auto max-w-3xl" />;
}
