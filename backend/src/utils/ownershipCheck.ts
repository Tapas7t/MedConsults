import { Model, Types } from 'mongoose';

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Asserts that a resource exists and belongs to the given user.
 * Always throws 404 NOT_FOUND on any mismatch to prevent IDOR / resource enumeration.
 */
export async function assertOwnership<T>(
  ModelClass: Model<T>,
  resourceId: string,
  userId: string,
  userField: string = 'userId'
): Promise<T> {
  if (!Types.ObjectId.isValid(resourceId) || !Types.ObjectId.isValid(userId)) {
    throw new NotFoundError();
  }

  const query: Record<string, any> = {
    _id: new Types.ObjectId(resourceId),
    [userField]: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  };

  const doc = await ModelClass.findOne(query as any);
  if (!doc) {
    throw new NotFoundError();
  }

  return doc;
}
