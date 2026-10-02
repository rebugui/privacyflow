import { Modal } from "./Modal";
export function TemplateChoice({ title, onChoose, onClose }: { title: string; onChoose: (template: boolean) => void; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}>
    <p className="preview">실제 개인정보 값은 입력하지 마세요. 항목명과 처리 활동만 기록하는 편집기입니다.</p>
    <p className="muted">수집 · 이용 · 보관 · 제공 · 위탁 · 파기를 구분해 작성하세요. 도면은 법적 적합성이나 인증을 자동 보장하지 않습니다.</p>
    <div className="template-choices"><button onClick={() => onChoose(true)}><strong>합성 예제</strong><span>정보주체 → 수집 → 회원관리 → 보관 → 파기<br />배송사 제공 · 상담업체 위탁의 별도 분기<br />7개 노드 · 6개 방향 흐름</span></button><button onClick={() => onChoose(false)}><strong>빈 캔버스</strong><span>처리 단계와 종류를 직접 선택해 시작합니다.<br />타이틀 블록 · 단계 범례 자동 생성</span></button></div>
    <p className="muted">편집 데이터는 이 브라우저에서만 처리합니다. 자동 저장과 JSON은 평문이며, 암호화·로그인·서버 동기화는 제공하지 않습니다.</p>
  </Modal>;
}
