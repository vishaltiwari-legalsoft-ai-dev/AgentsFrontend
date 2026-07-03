"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Label, Layer, Rect, Stage, Tag, Text, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { GdElement } from "@/lib/api";
import { pxToFrac } from "@/lib/canvasMath";
import { elementSrc } from "@/lib/elementSrc";
import { tintedCanvas } from "@/lib/tintImage";

export interface DragMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

interface Props {
  previewSrc?: string;
  aspect: number; // height / width, used before the preview image loads
  markers: DragMarker[];
  onMove: (id: string, x: number, y: number) => void;
  elements: GdElement[];
  onElementsChange: (els: GdElement[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function ElementNode({ el, W, H, onSelect, onCommit, nodeRef }: {
  el: GdElement; W: number; H: number;
  onSelect: (id: string) => void;
  onCommit: (id: string, patch: Partial<GdElement>) => void;
  nodeRef?: (n: Konva.Image | null) => void;
}) {
  const [img] = useImage(elementSrc(el));
  const image = useMemo(
    () => (el.kind === "icon" && img ? tintedCanvas(img, el.fill) : img),
    [img, el.kind, el.fill],
  );
  const w = el.w * W, h = el.h * H;
  return (
    <KImage
      ref={nodeRef}
      image={image}
      x={el.x * W} y={el.y * H}
      width={w} height={h}
      offsetX={w / 2} offsetY={h / 2}   /* anchor "mc": x/y is the center */
      rotation={el.rotation} opacity={el.opacity}
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        onCommit(el.id, { x: pxToFrac(e.target.x(), W), y: pxToFrac(e.target.y(), H) })}
      onTransformEnd={(e: KonvaEventObject<Event>) => {
        const n = e.target;
        const size = Math.min(1, Math.max(0.03, (n.width() * n.scaleX()) / W));
        n.scaleX(1); n.scaleY(1);
        onCommit(el.id, {
          x: pxToFrac(n.x(), W), y: pxToFrac(n.y(), H),
          w: size, h: size, rotation: Math.round(n.rotation()),
        });
      }}
    />
  );
}

export default function KonvaCanvas({
  previewSrc, aspect, markers, onMove,
  elements, onElementsChange, selectedId, onSelect,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const W = useContainerWidth(boxRef);
  const [bg] = useImage(previewSrc ?? "");
  const H = Math.round(W * (bg ? bg.height / bg.width : aspect));
  const trRef = useRef<Konva.Transformer>(null);
  const selectedNode = useRef<Konva.Image | null>(null);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(selectedNode.current && selectedId ? [selectedNode.current] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, W]);

  const commit = (id: string, patch: Partial<GdElement>) =>
    onElementsChange(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  if (W === 0) return <div ref={boxRef} style={{ width: "100%" }} />;
  return (
    <div ref={boxRef} style={{ width: "100%" }}>
      <Stage
        width={W} height={H}
        onMouseDown={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}
      >
        <Layer>
          {bg && <KImage image={bg} width={W} height={H} listening={false} />}

          {[...elements].sort((a, b) => a.z - b.z).map((el) => (
            <ElementNode
              key={el.id} el={el} W={W} H={H}
              onSelect={onSelect} onCommit={commit}
              nodeRef={el.id === selectedId ? (n) => { selectedNode.current = n; } : undefined}
            />
          ))}

          {markers.map((m) =>
            m.w && m.h ? (
              <Rect /* shape bounding box, matches old gddrag__box */
                key={m.id}
                x={m.x * W} y={m.y * H}
                width={m.w * W} height={m.h * H}
                offsetX={(m.w * W) / 2} offsetY={(m.h * H) / 2}
                stroke="#5B8DEF" strokeWidth={1.5} dash={[6, 4]}
                draggable
                onClick={() => onSelect(m.id)}
                onDragEnd={(e) => onMove(m.id, pxToFrac(e.target.x(), W), pxToFrac(e.target.y(), H))}
              />
            ) : (
              <Label /* text/cta/venue/website chip, matches old gddrag__chip */
                key={m.id}
                x={m.x * W} y={m.y * H}
                draggable
                onClick={() => onSelect(m.id)}
                onDragEnd={(e) => onMove(m.id, pxToFrac(e.target.x(), W), pxToFrac(e.target.y(), H))}
              >
                <Tag fill="#111827" opacity={0.85} cornerRadius={6}
                     pointerDirection="down" pointerWidth={8} pointerHeight={6} />
                <Text text={m.label} fontSize={12} fill="#fff" padding={6} />
              </Label>
            ),
          )}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
