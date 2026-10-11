import { createFileRoute } from "@tanstack/react-router";
import { ClientApp } from "@/components/svoy/client-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ClientApp />;
}
