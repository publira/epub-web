import { FormattedMessage, useIntl } from "react-intl";

import { Dialog, DialogClose, DialogContent } from "./ui/dialog";

interface TermsDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}

export const TermsDialog = ({ dialogRef }: TermsDialogProps) => {
  const intl = useIntl();

  return (
    <Dialog aria-labelledby="terms-dialog-title" dialogRef={dialogRef}>
      <DialogContent>
        <DialogClose aria-label={intl.formatMessage({ id: "terms.close" })} />
        <h2 className="font-heading m-0 text-xl" id="terms-dialog-title">
          <FormattedMessage id="terms.title" />
        </h2>
        <h3 className="mt-4 mb-0 text-sm font-semibold text-primary/90">
          <FormattedMessage id="terms.section1.title" />
        </h3>
        <p className="mt-4 mb-0 leading-7">
          <FormattedMessage id="terms.section1.body" />
        </p>
        <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
          <FormattedMessage id="terms.section2.title" />
        </h3>
        <p className="mt-2 mb-0 leading-7">
          <FormattedMessage id="terms.section2.body" />
        </p>
        <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
          <FormattedMessage id="terms.section3.title" />
        </h3>
        <p className="mt-2 mb-0 leading-7">
          <FormattedMessage id="terms.section3.body" />
        </p>
        <h3 className="mt-5 mb-0 text-sm font-semibold text-primary/90">
          <FormattedMessage id="terms.section4.title" />
        </h3>
        <p className="mt-2 mb-0 leading-7">
          <FormattedMessage id="terms.section4.body" />
        </p>
      </DialogContent>
    </Dialog>
  );
};
