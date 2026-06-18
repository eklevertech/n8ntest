import { requirePageAuth } from "@/lib/require-auth";
import { NewCameraForm } from "@/components/NewCameraForm";

export const dynamic = "force-dynamic";

export default async function NewCameraPage() {
  await requirePageAuth();
  return <NewCameraForm />;
}
