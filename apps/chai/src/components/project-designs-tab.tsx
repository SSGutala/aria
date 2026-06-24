"use client";

import { useRouter } from "next/navigation";
import { StyleCarousel } from "./style-carousel";
import { DesignHandoffPanel } from "./design-handoff-panel";

type Variant = {
  id: string;
  name: string;
  styleKey: string;
  previewHtml?: string | null;
  previewImage?: string | null;
  selected: boolean;
  figmaEmbedUrl?: string | null;
  figmaOpenUrl?: string | null;
};

type Props = {
  projectId: string;
  userId: string;
  variants: Variant[];
};

export function ProjectDesignsTab({ projectId, userId, variants }: Props) {
  const router = useRouter();
  const activeVariant = variants[0];

  const onSelectionChange = async (ids: string[]) => {
    await fetch(`/api/projects/${projectId}/designs/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantIds: ids }),
    });
    router.refresh();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <StyleCarousel
        variants={variants}
        onSelectionChange={onSelectionChange}
      />
      {activeVariant && (
        <DesignHandoffPanel
          projectId={projectId}
          variant={activeVariant}
          userId={userId}
        />
      )}
    </div>
  );
}
