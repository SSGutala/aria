"use client";

import { useState } from "react";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { ChatPanel, type ChatMessage } from "./chat-panel";
import { BuildCanvas } from "./build-canvas";

type Artifact = {
  id: string;
  type: string;
  title: string;
  content: string;
  externalLinks: string;
};

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
  title: string;
  status: string;
  artifacts: Artifact[];
  variants: Variant[];
  messages: ChatMessage[];
  initialTab?: string;
};

export function WorkspaceClient({
  projectId,
  userId,
  title,
  status: initialStatus,
  artifacts,
  variants,
  messages,
  initialTab,
}: Props) {
  const [status, setStatus] = useState(initialStatus);

  return (
    <div className="flex h-screen overflow-hidden bg-chai-bg">
      <WorkspaceSidebar activeProjectId={projectId} userId={userId} />
      <div className="flex min-w-0 flex-1">
        <div className="flex w-[min(420px,38vw)] shrink-0 flex-col border-r border-chai-border">
          <ChatPanel
            projectId={projectId}
            initialMessages={messages}
            projectStatus={status}
            onStatusChange={setStatus}
          />
        </div>
        <BuildCanvas
          projectId={projectId}
          userId={userId}
          title={title}
          status={status}
          artifacts={artifacts}
          variants={variants}
          activeTab={initialTab}
        />
      </div>
    </div>
  );
}
