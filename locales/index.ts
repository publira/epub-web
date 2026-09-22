import en from "./en.json";
import ja from "./ja.json";

/** The English catalog defines the message IDs every catalog provides. */
export type MessageId = keyof typeof en;

/** Every catalog in this directory, keyed by language. */
export const catalogs: Record<string, Record<MessageId, string>> = { en, ja };
