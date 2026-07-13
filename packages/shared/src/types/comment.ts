import type { UserPublicProfile } from './user.js';

// A flat comment on a post. Every comment is a direct child of the post — there
// is no nesting. `editedAt` is null until the body is changed after creation,
// after which the UI shows an "edited" tag. Deletes are hard (the row is gone),
// so there is no deleted/tombstone state to represent here.
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentWithAuthor extends Comment {
  author: UserPublicProfile;
}
