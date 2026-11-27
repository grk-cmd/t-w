/** 내려받기 아이콘 — 쟁반으로 내려오는 화살표(16칸 도트). 색은 글자색을 따라 눌리지 않는 단추에선 함께 흐려진다. */
export function DownloadIcon() {
  return (
    <svg
      className="ico"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="7" y="1" width="2" height="7" />
      <rect x="4" y="7" width="8" height="1" />
      <rect x="5" y="8" width="6" height="1" />
      <rect x="6" y="9" width="4" height="1" />
      <rect x="7" y="10" width="2" height="1" />
      <rect x="1" y="11" width="1" height="4" />
      <rect x="14" y="11" width="1" height="4" />
      <rect x="1" y="14" width="14" height="1" />
    </svg>
  );
}
