import { customAlphabet } from "nanoid";

// 24-character URL-safe id — chosen for CSRF-safe invitation tokens and
// request IDs. Not used for Mongo _id; those remain ObjectId.
const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const randomId = customAlphabet(alphabet, 24);
export const inviteToken = customAlphabet(alphabet, 48);
