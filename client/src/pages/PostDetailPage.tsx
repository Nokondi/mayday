import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FormattedMessage } from "react-intl";
import { getPost } from "../api/posts.js";
import { PostDetailContent } from "../components/posts/PostDetailContent.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!post)
    return (
      <div className="text-center py-20 text-gray-600">
        <FormattedMessage
          id="posts.detailPage.notFound"
          defaultMessage="Post not found"
        />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PostDetailContent
        post={post}
        variant="page"
        onDeleted={() => navigate("/")}
      />
    </div>
  );
}
