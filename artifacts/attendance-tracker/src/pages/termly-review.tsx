import { useParams } from "wouter";
import { useRole } from "@/hooks/use-role";
import { ReviewLoader } from "@/components/termly/review-loader";

export default function TermlyReviewPage() {
  const params = useParams<{ id: string }>();
  const role = useRole();
  const id = Number(params.id);
  return role === "learner"
    ? <ReviewLoader id={id} backHref="/learner-ilps" backLabel="My termly reviews" />
    : <ReviewLoader id={id} backHref="/ilp-tutor/reviews" backLabel="Reviews" />;
}
