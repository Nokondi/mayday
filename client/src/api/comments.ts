import type { CommentWithAuthor } from "@mayday/shared";
import { api } from "./client.js";

export async function getComments(
  postId: string,
): Promise<CommentWithAuthor[]> {
  const res = await api.get(`/posts/${postId}/comments`);
  return res.data;
}

export async function createComment(
  postId: string,
  body: string,
): Promise<CommentWithAuthor> {
  const res = await api.post(`/posts/${postId}/comments`, { body });
  return res.data;
}

export async function updateComment(
  postId: string,
  commentId: string,
  body: string,
): Promise<CommentWithAuthor> {
  const res = await api.put(`/posts/${postId}/comments/${commentId}`, { body });
  return res.data;
}

export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  await api.delete(`/posts/${postId}/comments/${commentId}`);
}
