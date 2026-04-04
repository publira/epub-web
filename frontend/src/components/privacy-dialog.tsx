import { X } from "lucide-react";

interface PrivacyDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose: () => void;
}

export const PrivacyDialog = ({ dialogRef, onClose }: PrivacyDialogProps) => (
  <dialog
    aria-labelledby="privacy-dialog-title"
    className="fixed top-1/2 left-1/2 m-0 max-h-[80dvh] w-[min(680px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-primary/20 bg-card-surface p-0 text-foreground shadow-card backdrop:bg-slate-900/40"
    onClose={onClose}
    ref={dialogRef}
  >
    <article className="relative p-6 pr-14">
      <form className="absolute top-4 right-4" method="dialog">
        <button
          aria-label="プライバシーポリシーを閉じる"
          className="grid size-9 place-items-center text-primary transition hover:rounded-full hover:bg-primary/10 focus-visible:rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 active:rounded-full active:bg-primary/10"
          type="submit"
        >
          <X aria-hidden="true" size={18} strokeWidth={2.25} />
        </button>
      </form>
      <h2 className="m-0 text-xl font-heading" id="privacy-dialog-title">
        プライバシーポリシー
      </h2>
      <h3 className="mt-4 mb-0 text-sm font-semibold text-primary/90">
        1. 基本方針
      </h3>
      <p className="mt-4 mb-0 leading-7">
        本サービスは、画像とePubの変換処理に必要な範囲でファイルデータをサーバー上で取り扱います。恒久保存を目的とはしておらず、処理後のデータは運用上必要な期間を超えて保持しない方針です。
      </p>
      <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
        2. 収集する情報と利用目的
      </h3>
      <p className="mt-2 mb-0 leading-7">
        取得する情報には、アップロードファイル、処理結果、アクセス時刻、IPアドレス、User-Agentなどの技術情報が含まれる場合があります。これらはサービス提供、障害対応、不正利用防止、品質改善のために利用します。
      </p>
      <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
        3. Cookie等の利用
      </h3>
      <p className="mt-2 mb-0 leading-7">
        本サービスは、利用状況の把握や継続的改善のためにCookieまたはそれに類する技術を利用する場合があります。ブラウザ設定で無効化できますが、一部機能が正常に動作しない可能性があります。
      </p>
      <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
        4. 改定
      </h3>
      <p className="mt-2 mb-0 leading-7">
        運営者は、法令改正やサービス内容の変更に応じて本ポリシーを改定することがあります。重要な変更がある場合は、本ページ上で告知します。
      </p>
    </article>
  </dialog>
);
