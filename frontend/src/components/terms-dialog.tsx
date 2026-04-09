import { X } from "lucide-react";

import { useDialogScrollLock } from "../lib/hooks";

interface TermsDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}

export const TermsDialog = ({ dialogRef }: TermsDialogProps) => {
  useDialogScrollLock(dialogRef);

  return (
    <dialog
      aria-labelledby="terms-dialog-title"
      className="fixed top-1/2 left-1/2 m-0 max-h-[80dvh] w-[min(680px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-primary/20 bg-card-surface p-0 text-foreground shadow-card backdrop:bg-slate-900/40"
      ref={dialogRef}
    >
      <article className="relative p-6 pr-14">
        <form className="absolute top-4 right-4" method="dialog">
          <button
            aria-label="利用規約を閉じる"
            className="grid size-9 place-items-center text-primary transition hover:rounded-full hover:bg-primary/10 focus-visible:rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 active:rounded-full active:bg-primary/10"
            type="submit"
          >
            <X aria-hidden="true" size={18} strokeWidth={2.25} />
          </button>
        </form>
        <h2 className="m-0 text-xl font-heading" id="terms-dialog-title">
          利用規約
        </h2>
        <h3 className="mt-4 mb-0 text-sm font-semibold text-primary/90">
          1. 本規約の適用
        </h3>
        <p className="mt-4 mb-0 leading-7">
          本サービスは、画像とEPUBの相互変換機能を試用できるデモとして提供します。利用者は本サービスを利用した時点で、本規約に同意したものとみなします。
        </p>
        <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
          2. データの取扱い
        </h3>
        <p className="mt-2 mb-0 leading-7">
          本サービスは、入力ファイルをサーバー上で処理します。運営者は恒久保存を目的とせず最小限の運用を行いますが、通信経路や外部環境を含めて完全な安全性を保証するものではありません。機微情報を含むデータの利用可否は、利用者自身の責任で判断してください。
        </p>
        <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
          3. 禁止事項
        </h3>
        <p className="mt-2 mb-0 leading-7">
          利用者は、法令または第三者の権利を侵害する目的で本サービスを利用してはなりません。著作権、商標権、肖像権、プライバシー権などに関する問題が生じた場合、利用者が自ら解決するものとします。
        </p>
        <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
          4. 免責
        </h3>
        <p className="mt-2 mb-0 leading-7">
          本サービスは現状有姿で提供され、変換結果の正確性、可用性、継続性、特定目的適合性を保証しません。運営者は、本サービスの利用または利用不能により生じたいかなる損害についても、運営者に故意または重過失がある場合を除き責任を負いません。
        </p>
      </article>
    </dialog>
  );
};
