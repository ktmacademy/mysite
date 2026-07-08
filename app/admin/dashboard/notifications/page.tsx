"use client";

import { Bell } from "lucide-react";
import ContentManagerPage from "@/components/content-manager-page";

export default function NotificationsPage() {
  return (
    <ContentManagerPage
      table="notifications"
      heading="Notification"
      itemNoun="notification"
      icon={Bell}
    />
  );
}
