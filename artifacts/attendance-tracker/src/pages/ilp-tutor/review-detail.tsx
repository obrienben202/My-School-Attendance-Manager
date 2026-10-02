import { useParams } from "wouter";
import { ReviewLoader } from "@/components/termly/review-loader";

export default function IlpTutorReviewDetail() {
  const params = useParams<{ id: string }>();
  return <ReviewLoader id={Number(params.id)} backHref="/ilp-tutor/reviews" backLabel="Reviews" />;
}
