import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../../src/api/client.js";
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from "../../src/api/comments.js";

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("comments api", () => {
  it("getComments GETs the post's comments", async () => {
    const data = [{ id: "c1", body: "hi" }];
    mockedApi.get.mockResolvedValueOnce({ data });

    const result = await getComments("p1");

    expect(mockedApi.get).toHaveBeenCalledWith("/posts/p1/comments");
    expect(result).toEqual(data);
  });

  it("createComment POSTs the body to the post's comments", async () => {
    const data = { id: "c1", body: "hello" };
    mockedApi.post.mockResolvedValueOnce({ data });

    const result = await createComment("p1", "hello");

    expect(mockedApi.post).toHaveBeenCalledWith("/posts/p1/comments", {
      body: "hello",
    });
    expect(result).toEqual(data);
  });

  it("updateComment PUTs the new body to the comment", async () => {
    const data = { id: "c1", body: "edited" };
    mockedApi.put.mockResolvedValueOnce({ data });

    const result = await updateComment("p1", "c1", "edited");

    expect(mockedApi.put).toHaveBeenCalledWith("/posts/p1/comments/c1", {
      body: "edited",
    });
    expect(result).toEqual(data);
  });

  it("deleteComment DELETEs the comment", async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { message: "Comment deleted" } });

    await deleteComment("p1", "c1");

    expect(mockedApi.delete).toHaveBeenCalledWith("/posts/p1/comments/c1");
  });
});
