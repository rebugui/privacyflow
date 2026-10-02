import { useEffect } from "react";
import {
  useNodesInitialized,
  useUpdateNodeInternals,
  useReactFlow,
} from "@xyflow/react";

export function Ready({ done }: { done: () => void }) {
  const ready = useNodesInitialized();
  const update = useUpdateNodeInternals();
  const flow = useReactFlow();
  useEffect(() => {
    update(flow.getNodes().map((node) => node.id));
  }, [update, flow]);
  useEffect(() => {
    if (ready) done();
  }, [ready, done]);
  return null;
}
