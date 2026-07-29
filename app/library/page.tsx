import { redirect } from "next/navigation";
import { clerkAuthFromServerComponent } from "../clerk-auth";
import GatewayPlayer from "../components/GatewayPlayer";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const { userId } = await clerkAuthFromServerComponent();
  if (!userId) redirect("/");
  return <GatewayPlayer />;
}
