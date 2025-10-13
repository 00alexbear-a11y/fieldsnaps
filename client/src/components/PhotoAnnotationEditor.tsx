import { useState, useRef, useEffect } from "react";
import { Type, ArrowUpRight, Minus, Circle, Trash2, Undo, Pen, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Annotation {
  id: string;
  type: "text" | "arrow" | "line" | "circle" | "pen";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  rotation?: number; // in degrees
  scale?: number; // scale multiplier
  position: {
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
  };
}

const colors = [
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Black", value: "#000000" },
  { name: "White", value: "#ffffff" },
];

const strokeSizes = [
  { name: "XS", value: 3 },
  { name: "S", value: 5 },
  { name: "M", value: 8 },
  { name: "L", value: 12 },
];

function ZoomCircle({ 
  position, 
  mainCanvasRef 
}: { 
  position: { x: number; y: number }; 
  mainCanvasRef: React.RefObject<HTMLCanvasElement>;
}) {
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = zoomCanvasRef.current;
    const mainCanvas = mainCanvasRef.current;
    if (!canvas || !mainCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const zoomFactor = 2;
    const sourceSize = 128 / zoomFactor;

    ctx.clearRect(0, 0, 128, 128);
    
    ctx.drawImage(
      mainCanvas,
      position.x - sourceSize / 2,
      position.y - sourceSize / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      128,
      128
    );

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 56);
    ctx.lineTo(64, 72);
    ctx.moveTo(56, 64);
    ctx.lineTo(72, 64);
    ctx.stroke();
  }, [position, mainCanvasRef]);

  return (
    <div
      className="fixed top-4 right-4 pointer-events-none"
      style={{ zIndex: 10001 }}
    >
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-black/90">
        <canvas
          ref={zoomCanvasRef}
          width={128}
          height={128}
          className="w-full h-full"
        />
        <div className="absolute bottom-1 left-0 right-0 text-center text-white text-xs font-bold bg-black/60 py-0.5">
          2x
        </div>
      </div>
    </div>
  );
}

interface PhotoAnnotationEditorProps {
  photoUrl: string;
  photoId: string;
  existingAnnotations?: Annotation[];
  onSave: (annotations: Annotation[]) => void;
  onCancel?: () => void;
}

type ResizeHandle = "start" | "end" | "radius" | "corner" | "rotate";

export function PhotoAnnotationEditor({
  photoUrl,
  photoId,
  existingAnnotations = [],
  onSave,
  onCancel,
}: PhotoAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(existingAnnotations);
  const [history, setHistory] = useState<Annotation[][]>([existingAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<"text" | "arrow" | "line" | "circle" | "pen" | "select" | null>(null);
  const [selectedColor, setSelectedColor] = useState(colors[0].value);
  const [strokeWidth, setStrokeWidth] = useState(strokeSizes[1].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialAnnoState, setInitialAnnoState] = useState<Annotation | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>("default");
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [zoomCirclePos, setZoomCirclePos] = useState<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const getTouchCanvasCoordinates = (e: React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } => {
    if (!canvasRef.current || !e.touches[0]) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.touches[0].clientX - rect.left) * scaleX;
    const y = (e.touches[0].clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  useEffect(() => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleImageLoad = () => {
      let width = img.naturalWidth || img.width || 800;
      let height = img.naturalHeight || img.height || 600;
      
      const MAX_CANVAS_WIDTH = 1200;
      if (width > MAX_CANVAS_WIDTH) {
        const scale = MAX_CANVAS_WIDTH / width;
        width = MAX_CANVAS_WIDTH;
        height = Math.round(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      redrawCanvas();
    };

    if (img.complete && img.naturalWidth > 0) {
      handleImageLoad();
    } else if (img.complete && img.naturalWidth === 0) {
      console.warn("Image failed to load, using default canvas dimensions:", photoUrl);
      canvas.width = 800;
      canvas.height = 600;
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Image failed to load", 400, 300);
    } else {
      img.onload = handleImageLoad;
      img.onerror = (e) => {
        console.error("Failed to load photo for annotation:", photoUrl);
        canvas.width = 800;
        canvas.height = 600;
        ctx.fillStyle = "#374151";
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = "#9ca3af";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Image failed to load", 400, 300);
      };
    }

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [photoUrl]);

  useEffect(() => {
    redrawCanvas();
  }, [annotations, selectedAnnotation, tempAnnotation]);

  const addToHistory = (newAnnotations: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
      setSelectedAnnotation(null);
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Image failed to load - annotations still work", canvas.width / 2, canvas.height / 2);
    }

    const allAnnotations = tempAnnotation 
      ? [...annotations, tempAnnotation]
      : annotations;

    allAnnotations.forEach((annotation) => {
      const isSelected = selectedAnnotation === annotation.id;
      const isTemp = annotation.id === tempAnnotation?.id;
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = annotation.strokeWidth;
      
      if (isTemp) {
        ctx.globalAlpha = 0.7;
      }

      switch (annotation.type) {
        case "text":
          if (annotation.content && annotation.position.x !== undefined) {
            const fontSize = annotation.fontSize || 20;
            const rotation = annotation.rotation || 0;
            const scale = annotation.scale || 1;
            
            ctx.save();
            
            // Apply transformations
            ctx.translate(annotation.position.x, annotation.position.y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            
            ctx.font = `${fontSize}px Arial`;
            const textMetrics = ctx.measureText(annotation.content);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            const padding = 8;
            const borderRadius = 6;
            
            const boxX = -padding;
            const boxY = -textHeight - padding;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = textHeight + padding * 2;
            
            // Draw background box
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
            ctx.fill();
            
            // Draw text
            ctx.fillStyle = annotation.color;
            ctx.fillText(annotation.content, 0, 0);
            
            ctx.restore();
            
            // Draw handles (outside transformation)
            if (isSelected) {
              ctx.save();
              ctx.translate(annotation.position.x, annotation.position.y);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.scale(scale, scale);
              
              // Scale handle (right side)
              drawHandle(ctx, textWidth, 0, "#3b82f6");
              // Rotation handle (top center)
              drawHandle(ctx, textWidth / 2, -textHeight / 2 - 20, "#22c55e");
              
              ctx.restore();
            }
          }
          break;
        case "arrow":
          if (
            annotation.position.x !== undefined &&
            annotation.position.y !== undefined &&
            annotation.position.x2 !== undefined &&
            annotation.position.y2 !== undefined
          ) {
            drawArrow(
              ctx,
              annotation.position.x,
              annotation.position.y,
              annotation.position.x2,
              annotation.position.y2,
              annotation.strokeWidth,
              annotation.color
            );
            if (isSelected) {
              drawHandle(ctx, annotation.position.x, annotation.position.y, "#3b82f6");
              drawHandle(ctx, annotation.position.x2, annotation.position.y2, "#3b82f6");
            }
          }
          break;
        case "line":
          if (
            annotation.position.x !== undefined &&
            annotation.position.y !== undefined &&
            annotation.position.x2 !== undefined &&
            annotation.position.y2 !== undefined
          ) {
            // Apply stroke width scaling: XS/S use 1.5x, M/L use 4.5x (3x bigger)
            const lineScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = annotation.strokeWidth * lineScaleFactor;
            ctx.beginPath();
            ctx.moveTo(annotation.position.x, annotation.position.y);
            ctx.lineTo(annotation.position.x2, annotation.position.y2);
            ctx.stroke();
            if (isSelected) {
              drawHandle(ctx, annotation.position.x, annotation.position.y, "#3b82f6");
              drawHandle(ctx, annotation.position.x2, annotation.position.y2, "#3b82f6");
            }
          }
          break;
        case "circle":
          if (
            annotation.position.x !== undefined &&
            annotation.position.y !== undefined &&
            annotation.position.width !== undefined
          ) {
            // Calculate center as midpoint between two edge points
            const centerX = annotation.position.x2 !== undefined 
              ? (annotation.position.x + annotation.position.x2) / 2
              : annotation.position.x;
            const centerY = annotation.position.y2 !== undefined
              ? (annotation.position.y + annotation.position.y2) / 2
              : annotation.position.y;
            
            // Apply stroke width scaling: XS/S use 1.5x, M/L use 4.5x (3x bigger)
            const circleScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = annotation.strokeWidth * circleScaleFactor;
            ctx.beginPath();
            ctx.arc(
              centerX,
              centerY,
              annotation.position.width,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            if (isSelected && annotation.position.x2 !== undefined && annotation.position.y2 !== undefined) {
              // Draw handles at edge points for edge-to-edge circle
              drawHandle(ctx, annotation.position.x, annotation.position.y, "#3b82f6");
              drawHandle(ctx, annotation.position.x2, annotation.position.y2, "#3b82f6");
            }
          }
          break;
        case "pen":
          if (annotation.position.points && annotation.position.points.length > 0) {
            // Apply stroke width scaling: XS/S use 1.5x, M/L use 4.5x (3x bigger)
            const penScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = annotation.strokeWidth * penScaleFactor;
            ctx.beginPath();
            const points = annotation.position.points;
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            if (isSelected && points.length > 0) {
              drawHandle(ctx, points[0].x, points[0].y, "#3b82f6");
              drawHandle(ctx, points[points.length - 1].x, points[points.length - 1].y, "#3b82f6");
            }
          }
          break;
      }
      
      if (isTemp) {
        ctx.globalAlpha = 1.0;
      }
    });
  };

  const drawHandle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    lineWidth: number,
    color: string
  ) => {
    // Apply stroke width scaling: XS/S use 1.5x, M/L use 4.5x
    const scaleFactor = lineWidth >= 8 ? 4.5 : 1.5;
    const thickerLineWidth = lineWidth * scaleFactor;
    
    const arrowLength = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    
    // Arrowhead size scales with the scaled line width
    const headLength = Math.min(arrowLength * 0.35, thickerLineWidth * 3);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Calculate the base of the arrowhead triangle
    const baseX = toX - headLength * Math.cos(angle);
    const baseY = toY - headLength * Math.sin(angle);

    // Draw arrow shaft - STOP at the base of the triangle
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = thickerLineWidth;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(baseX, baseY); // Stop at triangle base, not at tip
    ctx.stroke();

    // Draw filled arrowhead triangle - starts at exact tip
    ctx.beginPath();
    ctx.moveTo(toX, toY); // Arrow tip - exact point
    
    // Left wing - sharper angle (PI/9 = 20 degrees)
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 9),
      toY - headLength * Math.sin(angle - Math.PI / 9)
    );
    
    // Right wing - sharper angle (PI/9 = 20 degrees)
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 9),
      toY - headLength * Math.sin(angle + Math.PI / 9)
    );
    
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  const getHandleAtPoint = (anno: Annotation, x: number, y: number): ResizeHandle | null => {
    const handleSize = 16;
    
    switch (anno.type) {
      case "text":
        if (anno.content) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (ctx) {
            const fontSize = anno.fontSize || 20;
            const rotation = anno.rotation || 0;
            const scale = anno.scale || 1;
            
            ctx.font = `${fontSize}px Arial`;
            const textMetrics = ctx.measureText(anno.content);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            
            // Transform point to text's local coordinate system
            const dx = x - anno.position.x;
            const dy = y - anno.position.y;
            const rad = (-rotation * Math.PI) / 180;
            const localX = (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale;
            const localY = (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale;
            
            // Check rotation handle (top center)
            const rotateHandleX = textWidth / 2;
            const rotateHandleY = -textHeight / 2 - 20;
            const distanceToRotate = Math.sqrt(
              Math.pow(localX - rotateHandleX, 2) + Math.pow(localY - rotateHandleY, 2)
            );
            if (distanceToRotate <= handleSize / 2) {
              return "rotate";
            }
            
            // Check scale handle (right side)
            const scaleHandleX = textWidth;
            const scaleHandleY = 0;
            const distanceToScale = Math.sqrt(
              Math.pow(localX - scaleHandleX, 2) + Math.pow(localY - scaleHandleY, 2)
            );
            if (distanceToScale <= handleSize / 2) {
              return "corner";
            }
          }
        }
        break;
      case "arrow":
      case "line":
        if (anno.position.x2 !== undefined && anno.position.y2 !== undefined) {
          const distanceToStart = Math.sqrt(
            Math.pow(x - anno.position.x, 2) + Math.pow(y - anno.position.y, 2)
          );
          if (distanceToStart <= handleSize / 2) {
            return "start";
          }
          const distanceToEnd = Math.sqrt(
            Math.pow(x - anno.position.x2, 2) + Math.pow(y - anno.position.y2, 2)
          );
          if (distanceToEnd <= handleSize / 2) {
            return "end";
          }
        }
        break;
      case "circle":
        // Check edge point handles for edge-to-edge circle
        if (anno.position.x2 !== undefined && anno.position.y2 !== undefined) {
          const distanceToStart = Math.sqrt(
            Math.pow(x - anno.position.x, 2) + Math.pow(y - anno.position.y, 2)
          );
          if (distanceToStart <= handleSize / 2) {
            return "start";
          }
          const distanceToEnd = Math.sqrt(
            Math.pow(x - anno.position.x2, 2) + Math.pow(y - anno.position.y2, 2)
          );
          if (distanceToEnd <= handleSize / 2) {
            return "end";
          }
        }
        break;
    }
    return null;
  };

  const getClickedAnnotation = (x: number, y: number): Annotation | null => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const anno = annotations[i];
      
      switch (anno.type) {
        case "text":
          if (anno.content) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (ctx) {
              const fontSize = anno.fontSize || 20;
              const rotation = anno.rotation || 0;
              const scale = anno.scale || 1;
              
              ctx.font = `${fontSize}px Arial`;
              const textMetrics = ctx.measureText(anno.content);
              const textWidth = textMetrics.width;
              const textHeight = fontSize;
              
              // Transform click point to text's local coordinate system
              const dx = x - anno.position.x;
              const dy = y - anno.position.y;
              const rad = (-rotation * Math.PI) / 180;
              const localX = (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale;
              const localY = (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale;
              
              // Check if click is within text bounds in local space
              const padding = 8;
              if (
                localX >= -padding &&
                localX <= textWidth + padding &&
                localY >= -textHeight - padding &&
                localY <= padding
              ) {
                return anno;
              }
            }
          }
          break;
        case "arrow":
        case "line":
          if (anno.position.x2 !== undefined && anno.position.y2 !== undefined) {
            const tolerance = 10;
            const distance = distanceToLineSegment(
              x, y,
              anno.position.x, anno.position.y,
              anno.position.x2, anno.position.y2
            );
            if (distance < tolerance) {
              return anno;
            }
            
            // For arrows, also check if click is inside the arrowhead triangle
            if (anno.type === "arrow") {
              const dx = anno.position.x2 - anno.position.x;
              const dy = anno.position.y2 - anno.position.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const unitX = dx / length;
              const unitY = dy / length;
              
              // strokeWidth is a number: 3 (XS), 5 (S), 8 (M), or 12 (L)
              // Apply stroke width scaling: XS/S use 1.5x, M/L use 4.5x
              const scaleFactor = anno.strokeWidth >= 8 ? 4.5 : 1.5;
              const thickerLineWidth = anno.strokeWidth * scaleFactor;
              const arrowheadSize = thickerLineWidth * 3;
              
              const arrowTipX = anno.position.x2;
              const arrowTipY = anno.position.y2;
              const baseX = arrowTipX - unitX * arrowheadSize;
              const baseY = arrowTipY - unitY * arrowheadSize;
              const perpX = -unitY;
              const perpY = unitX;
              const left1X = baseX + perpX * (arrowheadSize * 0.5);
              const left1Y = baseY + perpY * (arrowheadSize * 0.5);
              const right1X = baseX - perpX * (arrowheadSize * 0.5);
              const right1Y = baseY - perpY * (arrowheadSize * 0.5);
              
              if (isPointInTriangle(x, y, arrowTipX, arrowTipY, left1X, left1Y, right1X, right1Y)) {
                return anno;
              }
            }
          }
          break;
        case "circle":
          if (anno.position.width !== undefined && anno.position.x2 !== undefined && anno.position.y2 !== undefined) {
            // Calculate center from edge points
            const centerX = (anno.position.x + anno.position.x2) / 2;
            const centerY = (anno.position.y + anno.position.y2) / 2;
            const distance = Math.sqrt(
              Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
            );
            const tolerance = 10;
            if (Math.abs(distance - anno.position.width) < tolerance) {
              return anno;
            }
          }
          break;
        case "pen":
          if (anno.position.points && anno.position.points.length > 0) {
            const tolerance = 10;
            for (let i = 0; i < anno.position.points.length - 1; i++) {
              const distance = distanceToLineSegment(
                x, y,
                anno.position.points[i].x, anno.position.points[i].y,
                anno.position.points[i + 1].x, anno.position.points[i + 1].y
              );
              if (distance < tolerance) {
                return anno;
              }
            }
          }
          break;
      }
    }
    return null;
  };

  const distanceToLineSegment = (
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const isPointInTriangle = (
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number
  ): boolean => {
    const areaOrig = Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1));
    const area1 = Math.abs((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py));
    const area2 = Math.abs((x2 - px) * (y3 - py) - (x3 - px) * (y2 - py));
    const area3 = Math.abs((x3 - px) * (y1 - py) - (x1 - px) * (y3 - py));
    return Math.abs(areaOrig - (area1 + area2 + area3)) < 1;
  };

  const updateCursor = (x: number, y: number) => {
    if (isDragging) {
      setCursorStyle("grabbing");
      return;
    }
    if (isResizing) {
      setCursorStyle("grabbing");
      return;
    }

    if (selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      if (anno) {
        const handle = getHandleAtPoint(anno, x, y);
        if (handle) {
          setCursorStyle("grab");
          return;
        }
      }
    }

    const clickedAnno = getClickedAnnotation(x, y);
    if (clickedAnno) {
      setCursorStyle("grab");
      return;
    }

    setCursorStyle(tool ? "default" : "default");
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoordinates(e);
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const parentRect = canvasRef.current.parentElement?.getBoundingClientRect();
    const displayX = parentRect ? e.clientX - parentRect.left : e.clientX - canvasRect.left;
    const displayY = parentRect ? e.clientY - parentRect.top : e.clientY - canvasRect.top;

    if (selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      if (anno) {
        const handle = getHandleAtPoint(anno, x, y);
        if (handle) {
          setIsResizing(true);
          setResizeHandle(handle);
          setDragStartPos({ x, y });
          setInitialAnnoState(JSON.parse(JSON.stringify(anno)));
          return;
        }
      }
    }

    const clickedAnno = getClickedAnnotation(x, y);

    if (clickedAnno) {
      setSelectedAnnotation(clickedAnno.id);
      setIsDragging(true);
      setDragStartPos({ x, y });
      setInitialAnnoState(JSON.parse(JSON.stringify(clickedAnno)));
      return;
    }

    setSelectedAnnotation(null);

    // Don't create new annotations if no tool is selected
    if (!tool) return;

    setIsCreating(true);
    setStartPos({ x, y });

    // Text tool now uses dialog, not inline positioning
    if (tool === "text") {
      setIsCreating(false);
      return;
    } else if (tool === "pen") {
      const newAnnotation: Annotation = {
        id: `temp-${Date.now()}`,
        type: "pen",
        color: selectedColor,
        strokeWidth,
        position: {
          x: 0,
          y: 0,
          points: [{ x, y }],
        },
      };
      setTempAnnotation(newAnnotation);
      setIsDrawing(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    
    updateCursor(x, y);

    if (isResizing && resizeHandle && dragStartPos && initialAnnoState && selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      if (!anno) return;

      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      const updatedAnnotations = annotations.map(a => {
        if (a.id !== selectedAnnotation) return a;
        
        const updated = { ...a };
        
        switch (resizeHandle) {
          case "start":
            if (a.type === "arrow" || a.type === "line") {
              updated.position = {
                ...a.position,
                x: initialAnnoState.position.x + dx,
                y: initialAnnoState.position.y + dy,
              };
            } else if (a.type === "circle") {
              // Edge-to-edge circle: update first edge point and recalculate radius
              const newX = initialAnnoState.position.x + dx;
              const newY = initialAnnoState.position.y + dy;
              const newRadius = Math.sqrt(
                Math.pow(initialAnnoState.position.x2! - newX, 2) + 
                Math.pow(initialAnnoState.position.y2! - newY, 2)
              ) / 2;
              updated.position = {
                ...a.position,
                x: newX,
                y: newY,
                width: Math.max(10, newRadius),
              };
            }
            break;
          case "end":
            if (a.type === "arrow" || a.type === "line") {
              updated.position = {
                ...a.position,
                x2: initialAnnoState.position.x2! + dx,
                y2: initialAnnoState.position.y2! + dy,
              };
            } else if (a.type === "circle") {
              // Edge-to-edge circle: update second edge point and recalculate radius
              const newX2 = initialAnnoState.position.x2! + dx;
              const newY2 = initialAnnoState.position.y2! + dy;
              const newRadius = Math.sqrt(
                Math.pow(newX2 - initialAnnoState.position.x, 2) + 
                Math.pow(newY2 - initialAnnoState.position.y, 2)
              ) / 2;
              updated.position = {
                ...a.position,
                x2: newX2,
                y2: newY2,
                width: Math.max(10, newRadius),
              };
            }
            break;
          case "radius":
            if (a.type === "circle") {
              const newRadius = Math.sqrt(
                Math.pow(x - a.position.x, 2) + Math.pow(y - a.position.y, 2)
              );
              updated.position = {
                ...a.position,
                width: Math.max(10, newRadius),
              };
            }
            break;
          case "corner":
            if (a.type === "text" && a.content) {
              // Scale text using the scale property
              const currentScale = initialAnnoState.scale || 1;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const direction = dx >= 0 ? 1 : -1;
              const scaleFactor = 1 + (direction * distance) / 150;
              const newScale = Math.max(0.5, Math.min(3, currentScale * scaleFactor));
              updated.scale = newScale;
            }
            break;
          case "rotate":
            if (a.type === "text" && a.content) {
              // Calculate rotation angle
              const centerX = initialAnnoState.position.x;
              const centerY = initialAnnoState.position.y;
              const currentRotation = initialAnnoState.rotation || 0;
              
              // Calculate angle from center to current mouse position
              const angleToMouse = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
              
              // Calculate initial angle when drag started
              const angleToStart = Math.atan2(dragStartPos.y - centerY, dragStartPos.x - centerX) * (180 / Math.PI);
              
              // Calculate rotation delta
              const rotationDelta = angleToMouse - angleToStart;
              
              // Apply rotation
              let newRotation = currentRotation + rotationDelta;
              
              // Normalize to -180 to 180
              while (newRotation > 180) newRotation -= 360;
              while (newRotation < -180) newRotation += 360;
              
              updated.rotation = newRotation;
            }
            break;
        }
        
        return updated;
      });

      setAnnotations(updatedAnnotations);
      return;
    }

    if (isDragging && dragStartPos && initialAnnoState && selectedAnnotation) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      const updatedAnnotations = annotations.map(a => {
        if (a.id !== selectedAnnotation) return a;
        
        const updated = { ...a };
        
        switch (a.type) {
          case "text":
            updated.position = {
              ...a.position,
              x: initialAnnoState.position.x + dx,
              y: initialAnnoState.position.y + dy,
            };
            break;
          case "arrow":
          case "line":
            updated.position = {
              ...a.position,
              x: initialAnnoState.position.x + dx,
              y: initialAnnoState.position.y + dy,
              x2: initialAnnoState.position.x2! + dx,
              y2: initialAnnoState.position.y2! + dy,
            };
            break;
          case "circle":
            updated.position = {
              ...a.position,
              x: initialAnnoState.position.x + dx,
              y: initialAnnoState.position.y + dy,
            };
            break;
          case "pen":
            if (initialAnnoState.position.points) {
              updated.position = {
                ...a.position,
                points: initialAnnoState.position.points.map(p => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
            }
            break;
        }
        
        return updated;
      });

      setAnnotations(updatedAnnotations);
      return;
    }

    if (isCreating && tool === "pen" && tempAnnotation && isDrawing) {
      const updated = { ...tempAnnotation };
      if (updated.position.points) {
        updated.position.points = [...updated.position.points, { x, y }];
      }
      setTempAnnotation(updated);
      return;
    }

    if (isCreating && startPos && tool && tool !== "text" && tool !== "pen" && tool !== "select") {
      const newAnnotation: Annotation = {
        id: `temp-${Date.now()}`,
        type: tool,
        color: selectedColor,
        strokeWidth,
        position: {
          x: startPos.x,
          y: startPos.y,
          x2: x,
          y2: y,
          // For circle: store both edge points, radius calculated as half distance
          width: tool === "circle" 
            ? Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2)) / 2
            : undefined,
        },
      };
      setTempAnnotation(newAnnotation);
      
      // Show zoom circle when creating arrows
      if (tool === "arrow") {
        setZoomCirclePos({ x, y });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (isResizing && selectedAnnotation) {
      addToHistory([...annotations]);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStartPos(null);
      setInitialAnnoState(null);
      return;
    }

    if (isDragging && selectedAnnotation) {
      addToHistory([...annotations]);
      setIsDragging(false);
      setDragStartPos(null);
      setInitialAnnoState(null);
      return;
    }

    if (isCreating && tempAnnotation && tool && tool !== "text") {
      if (tool === "pen") {
        const finalAnnotation = { ...tempAnnotation, id: `anno-${Date.now()}` };
        const newAnnotations = [...annotations, finalAnnotation];
        setAnnotations(newAnnotations);
        addToHistory(newAnnotations);
      } else if (startPos) {
        const finalAnnotation = { ...tempAnnotation, id: `anno-${Date.now()}` };
        const newAnnotations = [...annotations, finalAnnotation];
        setAnnotations(newAnnotations);
        addToHistory(newAnnotations);
      }
      setTempAnnotation(null);
      setIsCreating(false);
      setIsDrawing(false);
      setStartPos(null);
      setZoomCirclePos(null);
      setTool(null); // Auto-deselect tool after creating annotation
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current || !e.touches[0]) return;

    const { x, y } = getTouchCanvasCoordinates(e);

    if (selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      if (anno) {
        const handle = getHandleAtPoint(anno, x, y);
        if (handle) {
          setIsResizing(true);
          setResizeHandle(handle);
          setDragStartPos({ x, y });
          setInitialAnnoState(JSON.parse(JSON.stringify(anno)));
          return;
        }
      }
    }

    const clickedAnno = getClickedAnnotation(x, y);

    if (clickedAnno) {
      setSelectedAnnotation(clickedAnno.id);
      setIsDragging(true);
      setDragStartPos({ x, y });
      setInitialAnnoState(JSON.parse(JSON.stringify(clickedAnno)));
      return;
    }

    setSelectedAnnotation(null);

    if (!tool || tool === "select") return;

    setIsCreating(true);
    setStartPos({ x, y });

    if (tool === "pen") {
      const newAnnotation: Annotation = {
        id: `temp-${Date.now()}`,
        type: "pen",
        color: selectedColor,
        strokeWidth,
        position: {
          x: 0,
          y: 0,
          points: [{ x, y }],
        },
      };
      setTempAnnotation(newAnnotation);
      setIsDrawing(true);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!e.touches[0]) return;

    const { x, y } = getTouchCanvasCoordinates(e);

    if (isResizing && resizeHandle && dragStartPos && initialAnnoState && selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      if (!anno) return;

      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      const updatedAnnotations = annotations.map(a => {
        if (a.id !== selectedAnnotation) return a;
        
        const updated = { ...a };
        
        switch (resizeHandle) {
          case "start":
            if (a.type === "arrow" || a.type === "line") {
              updated.position = {
                ...a.position,
                x: initialAnnoState.position.x + dx,
                y: initialAnnoState.position.y + dy,
              };
            } else if (a.type === "circle") {
              // Edge-to-edge circle: update first edge point and recalculate radius
              const newX = initialAnnoState.position.x + dx;
              const newY = initialAnnoState.position.y + dy;
              const newRadius = Math.sqrt(
                Math.pow(initialAnnoState.position.x2! - newX, 2) + 
                Math.pow(initialAnnoState.position.y2! - newY, 2)
              ) / 2;
              updated.position = {
                ...a.position,
                x: newX,
                y: newY,
                width: Math.max(10, newRadius),
              };
            }
            break;
          case "end":
            if (a.type === "arrow" || a.type === "line") {
              updated.position = {
                ...a.position,
                x2: initialAnnoState.position.x2! + dx,
                y2: initialAnnoState.position.y2! + dy,
              };
            } else if (a.type === "circle") {
              // Edge-to-edge circle: update second edge point and recalculate radius
              const newX2 = initialAnnoState.position.x2! + dx;
              const newY2 = initialAnnoState.position.y2! + dy;
              const newRadius = Math.sqrt(
                Math.pow(newX2 - initialAnnoState.position.x, 2) + 
                Math.pow(newY2 - initialAnnoState.position.y, 2)
              ) / 2;
              updated.position = {
                ...a.position,
                x2: newX2,
                y2: newY2,
                width: Math.max(10, newRadius),
              };
            }
            break;
          case "radius":
            if (a.type === "circle") {
              const newRadius = Math.sqrt(
                Math.pow(x - a.position.x, 2) + Math.pow(y - a.position.y, 2)
              );
              updated.position = {
                ...a.position,
                width: Math.max(10, newRadius),
              };
            }
            break;
          case "corner":
            if (a.type === "text" && a.content) {
              // Scale text using the scale property
              const currentScale = initialAnnoState.scale || 1;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const direction = dx >= 0 ? 1 : -1;
              const scaleFactor = 1 + (direction * distance) / 150;
              const newScale = Math.max(0.5, Math.min(3, currentScale * scaleFactor));
              updated.scale = newScale;
            }
            break;
          case "rotate":
            if (a.type === "text" && a.content) {
              // Calculate rotation angle
              const centerX = initialAnnoState.position.x;
              const centerY = initialAnnoState.position.y;
              const currentRotation = initialAnnoState.rotation || 0;
              
              // Calculate angle from center to current mouse position
              const angleToMouse = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
              
              // Calculate initial angle when drag started
              const angleToStart = Math.atan2(dragStartPos.y - centerY, dragStartPos.x - centerX) * (180 / Math.PI);
              
              // Calculate rotation delta
              const rotationDelta = angleToMouse - angleToStart;
              
              // Apply rotation
              let newRotation = currentRotation + rotationDelta;
              
              // Normalize to -180 to 180
              while (newRotation > 180) newRotation -= 360;
              while (newRotation < -180) newRotation += 360;
              
              updated.rotation = newRotation;
            }
            break;
        }
        
        return updated;
      });

      setAnnotations(updatedAnnotations);
      return;
    }

    if (isDragging && dragStartPos && initialAnnoState && selectedAnnotation) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      const updatedAnnotations = annotations.map(a => {
        if (a.id !== selectedAnnotation) return a;
        
        const updated = { ...a };
        
        switch (a.type) {
          case "text":
            updated.position = {
              ...a.position,
              x: initialAnnoState.position.x + dx,
              y: initialAnnoState.position.y + dy,
            };
            break;
          case "arrow":
          case "line":
            updated.position = {
              ...a.position,
              x: initialAnnoState.position.x + dx,
              y: initialAnnoState.position.y + dy,
              x2: initialAnnoState.position.x2! + dx,
              y2: initialAnnoState.position.y2! + dy,
            };
            break;
          case "circle":
            updated.position = {
              ...a.position,
              x: initialAnnoState.position.x + dx,
              y: initialAnnoState.position.y + dy,
            };
            break;
          case "pen":
            if (initialAnnoState.position.points) {
              updated.position = {
                ...a.position,
                points: initialAnnoState.position.points.map(p => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
            }
            break;
        }
        
        return updated;
      });

      setAnnotations(updatedAnnotations);
      return;
    }

    if (isCreating && tool === "pen" && tempAnnotation && isDrawing) {
      const updated = { ...tempAnnotation };
      if (updated.position.points) {
        updated.position.points = [...updated.position.points, { x, y }];
      }
      setTempAnnotation(updated);
      return;
    }

    if (isCreating && startPos && tool && tool !== "text" && tool !== "pen" && tool !== "select") {
      const newAnnotation: Annotation = {
        id: `temp-${Date.now()}`,
        type: tool,
        color: selectedColor,
        strokeWidth,
        position: {
          x: startPos.x,
          y: startPos.y,
          x2: x,
          y2: y,
          // For circle: store both edge points, radius calculated as half distance
          width: tool === "circle" 
            ? Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2)) / 2
            : undefined,
        },
      };
      setTempAnnotation(newAnnotation);
      
      // Show zoom circle when creating arrows
      if (tool === "arrow") {
        setZoomCirclePos({ x, y });
      }
    }
  };

  const handleCanvasTouchEnd = () => {
    if (isResizing && selectedAnnotation) {
      addToHistory([...annotations]);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStartPos(null);
      setInitialAnnoState(null);
      return;
    }

    if (isDragging && selectedAnnotation) {
      addToHistory([...annotations]);
      setIsDragging(false);
      setDragStartPos(null);
      setInitialAnnoState(null);
      return;
    }

    if (isCreating && tempAnnotation && tool && tool !== "text") {
      if (tool === "pen") {
        const finalAnnotation = { ...tempAnnotation, id: `anno-${Date.now()}` };
        const newAnnotations = [...annotations, finalAnnotation];
        setAnnotations(newAnnotations);
        addToHistory(newAnnotations);
      } else if (startPos) {
        const finalAnnotation = { ...tempAnnotation, id: `anno-${Date.now()}` };
        const newAnnotations = [...annotations, finalAnnotation];
        setAnnotations(newAnnotations);
        addToHistory(newAnnotations);
      }
      setTempAnnotation(null);
      setIsCreating(false);
      setIsDrawing(false);
      setStartPos(null);
      setZoomCirclePos(null);
      setTool(null); // Auto-deselect tool after creating annotation
    }
  };

  const handleAddTextFromDialog = () => {
    if (!textInput.trim() || !canvasRef.current) return;

    // Place text in the center of the canvas
    const centerX = canvasRef.current.width / 2;
    const centerY = canvasRef.current.height / 2;

    const newAnnotation: Annotation = {
      id: `anno-${Date.now()}`,
      type: "text",
      content: textInput,
      color: selectedColor,
      strokeWidth,
      fontSize: Math.max(16, 20 + strokeWidth * 2),
      rotation: 0,
      scale: 1,
      position: {
        x: centerX,
        y: centerY,
      },
    };
    
    const newAnnotations = [...annotations, newAnnotation];
    setAnnotations(newAnnotations);
    addToHistory(newAnnotations);
    
    // Auto-select the new text so user can immediately reposition it
    setSelectedAnnotation(newAnnotation.id);
    setTool("select");
    
    // Close dialog and clear input
    setTextDialogOpen(false);
    setTextInput("");
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotation) {
      const newAnnotations = annotations.filter(a => a.id !== selectedAnnotation);
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
      setSelectedAnnotation(null);
      toast({
        title: "Annotation deleted",
        description: "The selected annotation has been removed",
      });
    }
  };

  const handleClearAll = () => {
    const newAnnotations: Annotation[] = [];
    setAnnotations(newAnnotations);
    addToHistory(newAnnotations);
    setSelectedAnnotation(null);
    toast({
      title: "Annotations cleared",
      description: "All annotations have been removed",
    });
  };

  const handleSave = () => {
    onSave(annotations);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
      {/* Canvas - Full screen */}
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          ref={imageRef}
          src={photoUrl}
          alt="Photo to annotate"
          className="hidden"
          crossOrigin="anonymous"
        />
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onTouchCancel={handleCanvasTouchEnd}
          style={{ 
            cursor: cursorStyle, 
            transition: "cursor 0.1s ease",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain"
          }}
          className="touch-none"
          data-testid="canvas-annotation"
        />
        
        {/* Magnified Zoom Circle - for arrow precision */}
        {zoomCirclePos && (
          <ZoomCircle 
            position={zoomCirclePos} 
            mainCanvasRef={canvasRef}
          />
        )}
      </div>

      {/* Bottom Toolbar - All tools in one compact bar */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pb-safe">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2 max-w-full overflow-x-auto">
          {/* Cancel Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            data-testid="button-cancel"
            className="rounded-full hover-elevate w-11 h-11 text-white flex-shrink-0"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="h-8 w-px bg-white/20 mx-1" />

          {/* Color Picker */}
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => setSelectedColor(color.value)}
              className={`w-11 h-11 rounded-full border-2 hover-elevate transition-all flex-shrink-0 ${
                selectedColor === color.value ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color.value }}
              data-testid={`button-color-${color.name.toLowerCase()}`}
              aria-label={`Color ${color.name}`}
            />
          ))}

          <div className="h-8 w-px bg-white/20 mx-1" />

          {/* Stroke Sizes */}
          {strokeSizes.map((size) => (
            <Button
              key={size.value}
              variant={strokeWidth === size.value ? "default" : "ghost"}
              size="icon"
              onClick={() => setStrokeWidth(size.value)}
              data-testid={`button-size-${size.name.toLowerCase()}`}
              className={`rounded-full hover-elevate text-xs font-bold w-11 h-11 flex-shrink-0 ${strokeWidth === size.value ? "" : "text-white"}`}
              aria-label={`Size ${size.name}`}
            >
              {size.name}
            </Button>
          ))}

          <div className="h-8 w-px bg-white/20 mx-1" />

          {/* Tool Buttons */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTextDialogOpen(true)}
            data-testid="button-tool-text"
            className="rounded-full hover-elevate w-11 h-11 text-white flex-shrink-0"
            aria-label="Add text"
          >
            <Type className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "arrow" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "arrow" ? null : "arrow")}
            data-testid="button-tool-arrow"
            className={`rounded-full hover-elevate w-11 h-11 flex-shrink-0 ${tool === "arrow" ? "" : "text-white"}`}
            aria-label="Arrow tool"
          >
            <ArrowUpRight className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "line" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "line" ? null : "line")}
            data-testid="button-tool-line"
            className={`rounded-full hover-elevate w-11 h-11 flex-shrink-0 ${tool === "line" ? "" : "text-white"}`}
            aria-label="Line tool"
          >
            <Minus className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "circle" ? null : "circle")}
            data-testid="button-tool-circle"
            className={`rounded-full hover-elevate w-11 h-11 flex-shrink-0 ${tool === "circle" ? "" : "text-white"}`}
            aria-label="Circle tool"
          >
            <Circle className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "pen" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "pen" ? null : "pen")}
            data-testid="button-tool-pen"
            className={`rounded-full hover-elevate w-11 h-11 flex-shrink-0 ${tool === "pen" ? "" : "text-white"}`}
            aria-label="Pen tool"
          >
            <Pen className="w-5 h-5" />
          </Button>

          <div className="h-8 w-px bg-white/20 mx-1" />

          {/* Actions */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            data-testid="button-undo"
            className="rounded-full hover-elevate w-11 h-11 text-white flex-shrink-0"
            aria-label="Undo"
          >
            <Undo className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteSelected}
            disabled={!selectedAnnotation}
            data-testid="button-delete"
            className="rounded-full hover-elevate w-11 h-11 text-white flex-shrink-0"
            aria-label="Delete selected"
          >
            <Trash2 className="w-5 h-5" />
          </Button>

          <div className="h-8 w-px bg-white/20 mx-1" />

          {/* Save Button */}
          <Button
            size="icon"
            onClick={handleSave}
            data-testid="button-save-annotations"
            className="rounded-full hover-elevate w-11 h-11 flex-shrink-0"
            aria-label="Save"
          >
            <Check className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Text Input Dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Add Text</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim()) {
                  handleAddTextFromDialog();
                } else if (e.key === "Escape") {
                  setTextDialogOpen(false);
                  setTextInput("");
                }
              }}
              autoFocus
              data-testid="input-text-dialog"
              className="text-base"
              style={{ color: selectedColor }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTextDialogOpen(false);
                setTextInput("");
              }}
              data-testid="button-cancel-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTextFromDialog}
              disabled={!textInput.trim()}
              data-testid="button-submit-text"
            >
              Add Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
