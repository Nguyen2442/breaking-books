import { redirect } from "next/navigation";

export default async function BookIndexPage({ params }) {
  const { bookId } = await params;
  redirect(`/books/${bookId}/ch/1`);
}
