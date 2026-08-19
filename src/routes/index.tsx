import { createFileRoute } from "@tanstack/react-router";
import { SolarApp } from "@/components/solar/solar-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SolarApp />;
}
