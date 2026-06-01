import { redirect } from "next/navigation";

// La page d'accueil est le planning.
export default function Home() {
  redirect("/planning");
}
