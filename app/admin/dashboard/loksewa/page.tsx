"use client";

import { Briefcase } from "lucide-react";
import ContentManagerPage from "@/components/content-manager-page";

export default function LoksewaPage() {
  return (
    <ContentManagerPage
      table="loksewa_details"
      heading="Loksewa URL"
      itemNoun="Loksewa resource"
      icon={Briefcase}
    />
  );
}
