import React from "react";
import { ACHistoryView } from "./ACHistoryView";

export const resolvePhotoUrl = (path?: string): string => {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  return `/api/files/${path}`;
};

export function History() {
  return (
    <div className="max-w-5xl mx-auto pb-24">
      <ACHistoryView />
    </div>
  );
}

export default History;
