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

/* Direct-manipulation text: the ACTUAL line rendered on the stage, draggable
   at 60fps, double-click to edit in place. fontSize is a fraction of the
   stage height (mirrors the engine's size_pct semantics). Client fonts are
   an editing approximation — the deterministic engine remains the truth. */
export interface TextNodeSpec {
  id: string;
  text: string;
  x: number;      // fraction, anchor mc (matches engine layout entries)
  y: number;
  maxW: number;   // fraction of width the line may occupy
  fontSize: number; // fraction of height
  fontFamily: string;
  fontStyle?: string; // "bold" | "italic" | "bold italic"
  fill: string;
  pill?: boolean; // CTA button treatment
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
  // Optional direct-manipulation text layer (V2 studio). Absent -> classic
  // marker-only behavior, byte-identical for existing callers.
  texts?: TextNodeSpec[];
  onTextMove?: (id: string, x: number, y: number) => void;
  onTextDblClick?: (id: string, clientX: number, clientY: number) => void;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
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
  texts, onTextMove, onTextDblClick,
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

          {/* Direct-manipulation text layer (V2): drag the REAL line, not a
              marker. Anchor mc mirrors the engine's layout entries, so the
              committed x/y round-trips 1:1 with the deterministic renderer. */}
          {(texts ?? []).map((t) => {
            const fs = Math.max(8, t.fontSize * H);
            const boxW = t.maxW * W;
            const common = {
              x: t.x * W,
              y: t.y * H,
              draggable: true,
              onClick: () => onSelect(t.id),
              onTap: () => onSelect(t.id),
              onDragEnd: (e: KonvaEventObject<DragEvent>) =>
                onTextMove?.(t.id, pxToFrac(e.target.x(), W), pxToFrac(e.target.y(), H)),
              onDblClick: (e: KonvaEventObject<MouseEvent>) =>
                onTextDblClick?.(t.id, e.evt.clientX, e.evt.clientY),
              onDblTap: (e: KonvaEventObject<Event>) => {
                const evt = e.evt as unknown as { clientX?: number; clientY?: number };
                onTextDblClick?.(t.id, evt.clientX ?? 0, evt.clientY ?? 0);
              },
            };
            return t.pill ? (
              <Label key={t.id} {...common} offsetX={boxW * 0.18} offsetY={fs}>
                <Tag fill="#D9A441" cornerRadius={fs * 1.4} />
                <Text
                  text={t.text}
                  fontSize={fs}
                  fontFamily={t.fontFamily}
                  fontStyle={t.fontStyle ?? "bold"}
                  fill="#1D2A50"
                  padding={fs * 0.6}
                  align="center"
                />
              </Label>
            ) : (
              <Text
                key={t.id}
                {...common}
                text={t.text}
                width={boxW}
                offsetX={boxW / 2}
                offsetY={fs * 0.65}
                fontSize={fs}
                fontFamily={t.fontFamily}
                fontStyle={t.fontStyle ?? "normal"}
                fill={t.fill}
                align="center"
                lineHeight={1.12}
                shadowColor="rgba(4,9,22,0.35)"
                shadowBlur={fs * 0.35}
                shadowOffsetY={2}
              />
            );
          })}

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
