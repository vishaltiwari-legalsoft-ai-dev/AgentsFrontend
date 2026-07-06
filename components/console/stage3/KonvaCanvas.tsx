"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KImage, Label, Layer, Rect, Stage, Tag, Text, Transformer } from "react-konva";
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
   stage WIDTH (the engine's size_pct semantics). Client fonts are an
   editing approximation — the deterministic engine remains the truth. */
export interface TextNodeSpec {
  id: string;
  text: string;
  x: number;      // fraction, anchor mc (matches engine layout entries)
  y: number;
  maxW: number;   // fraction of width the line may occupy
  fontSize: number; // fraction of width (engine size_pct semantics)
  fontFamily: string;
  fontStyle?: string; // "bold" | "italic" | "bold italic"
  fill: string;
  align?: "left" | "center" | "right"; // line alignment inside the box
  gradient?: [string, string];         // brand gradient text fill (vertical)
  lineFactor?: number; // engine line-gap: 1.15 headline, 1.4 others
  pill?: boolean;     // CTA button treatment
  pillFill?: string;  // CTA pill background (defaults to brand gold)
}

/* Mirror the engine's text geometry so anchor "mc" means the SAME pixels
   on both sides: greedy word-wrap at maxW, block = (widest line) x
   (lines x (asc+desc) x factor), centered on (x, y). Metrics come from the
   loaded brand FontFace, so they match the .otf Pillow uses. */
const measureCtx =
  typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;

function wrapMeasure(text: string, fontCss: string, maxW: number) {
  if (!measureCtx) return { lines: [text || ""], widest: maxW, asc: 0, desc: 0 };
  measureCtx.font = fontCss;
  const probeM = measureCtx.measureText("Mg");
  const asc = probeM.fontBoundingBoxAscent ?? 0;
  const desc = probeM.fontBoundingBoxDescent ?? 0;
  const lines: string[] = [];
  for (const seg of (text || "").split("\n")) {
    const words = seg.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let cur = "";
    for (const w of words) {
      const probe = cur ? `${cur} ${w}` : w;
      if (cur && measureCtx.measureText(probe).width > maxW) {
        lines.push(cur);
        cur = w;
      } else {
        cur = probe;
      }
    }
    if (cur) lines.push(cur);
  }
  const widest = Math.max(1, ...lines.map((l) => measureCtx.measureText(l).width));
  return { lines, widest, asc, desc };
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
  // Canva-style resize: side handles change the box width (text reflows),
  // corner handles scale the font. Both report fractions of the stage.
  onTextResize?: (id: string, wFrac: number, fontFrac: number) => void;
  // Single draggable/resizable overlay image (V2 Stage-4 logo). Fractions,
  // top-left anchored — mirrors the compositor's placement box.
  overlay?: { src: string; x: number; y: number; w: number; h: number };
  onOverlayCommit?: (box: { x: number; y: number; w: number }) => void;
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
  texts, onTextMove, onTextDblClick, onTextResize,
  overlay, onOverlayCommit,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const W = useContainerWidth(boxRef);
  const [bg] = useImage(previewSrc ?? "");
  const [overlayImg] = useImage(overlay?.src ?? "");
  const H = Math.round(W * (bg ? bg.height / bg.width : aspect));
  const trRef = useRef<Konva.Transformer>(null);
  const selectedNode = useRef<Konva.Node | null>(null);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(selectedNode.current && selectedId ? [selectedNode.current] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, texts, overlay, W]);

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
            // Engine size_pct is a % of canvas WIDTH — mirror that exactly,
            // or story/landscape formats wrap differently than the render.
            const fs = Math.max(8, t.fontSize * W);
            const boxW = t.maxW * W;
            const style = t.fontStyle ?? "normal";
            const fontCss = `${style === "normal" ? "" : `${style} `}${fs}px ${t.fontFamily}`;
            const wm = wrapMeasure(t.text, fontCss, boxW);
            const asc = wm.asc || fs * 0.88;
            const desc = wm.desc || fs * 0.24;
            const lineH = (asc + desc) * (t.lineFactor ?? 1.4);
            const blockH = lineH * Math.max(1, wm.lines.length);
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
            const reg = t.id === selectedId ? (n: Konva.Node | null) => { selectedNode.current = n; } : undefined;
            const resize = (e: KonvaEventObject<Event>) => {
              const n = e.target;
              const wFrac = Math.min(1, Math.max(0.08, (n.width() * n.scaleX()) / W));
              const fFrac = Math.max(0.008, (fs * n.scaleY()) / W);
              n.scaleX(1);
              n.scaleY(1);
              onTextResize?.(t.id, wFrac, fFrac);
            };
            if (t.pill) {
              // Mirror the engine's _draw_cta: label + "  →", pad_x = th*0.9,
              // pad_y = th*0.55, pill anchored mc on its own box.
              const label = `${t.text.replace(/\s+$/, "")}  →`;
              if (measureCtx) measureCtx.font = fontCss;
              const tw = measureCtx ? measureCtx.measureText(label).width : boxW * 0.5;
              const th = asc + desc;
              const padX = th * 0.9;
              const padY = th * 0.55;
              const pw = tw + 2 * padX;
              const ph = th + 2 * padY;
              return (
                <Group key={t.id} {...common} ref={reg} offsetX={pw / 2} offsetY={ph / 2} onTransformEnd={resize}>
                  <Rect
                    width={pw}
                    height={ph}
                    cornerRadius={ph / 2}
                    fill={t.pillFill ?? "#D9A441"}
                    shadowColor="rgba(9,16,34,0.35)"
                    shadowBlur={fs * 0.4}
                    shadowOffsetY={3}
                  />
                  <Text
                    x={padX}
                    y={padY}
                    width={tw}
                    height={th}
                    text={label}
                    fontSize={fs}
                    fontFamily={t.fontFamily}
                    fontStyle={t.fontStyle ?? "bold"}
                    fill={t.fill}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                </Group>
              );
            }
            return (
              <Text
                key={t.id}
                {...common}
                ref={reg}
                text={wm.lines.join("\n")}
                offsetX={wm.widest / 2}
                offsetY={blockH / 2}
                fontSize={fs}
                fontFamily={t.fontFamily}
                fontStyle={t.fontStyle ?? "normal"}
                {...(t.gradient
                  ? {
                      fillPriority: "linear-gradient",
                      fillLinearGradientStartPoint: { x: 0, y: 0 },
                      fillLinearGradientEndPoint: { x: 0, y: fs * 1.15 },
                      fillLinearGradientColorStops: [0, t.gradient[0], 1, t.gradient[1]],
                    }
                  : { fill: t.fill })}
                align={t.align ?? "left"}
                lineHeight={lineH / fs}
                shadowColor="rgba(4,9,22,0.35)"
                shadowBlur={fs * 0.35}
                shadowOffsetY={2}
                onTransformEnd={resize}
              />
            );
          })}

          {overlay && overlayImg ? (
            <KImage
              image={overlayImg}
              ref={(n) => {
                if (selectedId === "__overlay__") selectedNode.current = n;
              }}
              x={overlay.x * W}
              y={overlay.y * H}
              width={overlay.w * W}
              height={overlay.h * H}
              draggable
              onClick={() => onSelect("__overlay__")}
              onTap={() => onSelect("__overlay__")}
              onDragEnd={(e: KonvaEventObject<DragEvent>) =>
                onOverlayCommit?.({ x: pxToFrac(e.target.x(), W), y: pxToFrac(e.target.y(), H), w: overlay.w })}
              onTransformEnd={(e: KonvaEventObject<Event>) => {
                const n = e.target;
                const wFrac = Math.min(1, Math.max(0.03, (n.width() * n.scaleX()) / W));
                n.scaleX(1);
                n.scaleY(1);
                onOverlayCommit?.({ x: pxToFrac(n.x(), W), y: pxToFrac(n.y(), H), w: wFrac });
              }}
            />
          ) : null}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
