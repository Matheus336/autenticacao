import {
  DuplicateUserError,
  updateUserDocument,
} from "../repositories/user.repository";
import { HttpError } from "../utils/errors";

export function updateProfileDocument(
  userId: number,
  document: string,
): void {
  try {
    updateUserDocument(userId, document);
  } catch (error: unknown) {
    if (error instanceof DuplicateUserError) {
      throw new HttpError(409, "Este CPF já está associado a outra conta.");
    }
    throw error;
  }
}
