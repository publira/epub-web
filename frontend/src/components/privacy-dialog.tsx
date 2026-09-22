import { FormattedMessage, useIntl } from "react-intl";

import { Dialog, DialogClose, DialogContent } from "./ui/dialog";

interface PrivacyDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}

export const PrivacyDialog = ({ dialogRef }: PrivacyDialogProps) => {
  const intl = useIntl();

  return (
    <Dialog aria-labelledby="privacy-dialog-title" dialogRef={dialogRef}>
      <DialogContent>
        <DialogClose aria-label={intl.formatMessage({ id: "privacy.close" })} />
        <h2 className="m-0 text-xl" id="privacy-dialog-title">
          <FormattedMessage id="privacy.title" />
        </h2>
        <h3 className="mt-4 mb-0 text-sm font-medium">
          <FormattedMessage id="privacy.section1.title" />
        </h3>
        <p className="mt-4 mb-0 leading-7">
          <FormattedMessage id="privacy.section1.body" />
        </p>
        <h3 className="mt-5 mb-0 text-sm font-medium">
          <FormattedMessage id="privacy.section2.title" />
        </h3>
        <p className="mt-2 mb-0 leading-7">
          <FormattedMessage id="privacy.section2.body" />
        </p>
        <h3 className="mt-5 mb-0 text-sm font-medium">
          <FormattedMessage id="privacy.section3.title" />
        </h3>
        <p className="mt-2 mb-0 leading-7">
          <FormattedMessage id="privacy.section3.body" />
        </p>
        <h3 className="mt-5 mb-0 text-sm font-medium">
          <FormattedMessage id="privacy.section4.title" />
        </h3>
        <p className="mt-2 mb-0 leading-7">
          <FormattedMessage id="privacy.section4.body" />
        </p>
      </DialogContent>
    </Dialog>
  );
};
