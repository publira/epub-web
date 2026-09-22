import type { MessageId } from "@publira/epub-web-locales";

// Registers the catalog message IDs with react-intl, so `formatMessage` and
// `<FormattedMessage>` reject an unknown ID.
declare global {
  // oxlint-disable-next-line typescript/no-namespace -- react-intl reads message IDs from this global declaration merge.
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId;
    }
  }
}
