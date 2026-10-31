"use client";
import React, { useEffect } from 'react';
import { socketService } from "@/src/services/socket.service";
import AgentationToolbar from "@/components/AgentationToolbar";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return (
    <>
      {children}
      <AgentationToolbar />
    </>
  );
}
