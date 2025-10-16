import { useState, useRef, useEffect } from "react";
import { Type, ArrowUpRight, Minus, Circle, Trash2, Undo, Pen, X, Check, ChevronUp, ChevronDown, Ruler } from "lucide-react";
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
  type: "text" | "arrow" | "line" | "circle" | "pen" | "measurement";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  rotation?: number; // in degrees
  scale?: number; // scale multiplier
  feet?: number;
  inches?: number;
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
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Black", value: "#000000" },
  { name: "Gray", value: "#6b7280" },
  { name: "White", value: "#ffffff" },
];

const strokeSizes = [
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
  onSave: (annotations: Annotation[], annotatedBlob: Blob) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

type ResizeHandle = "start" | "end" | "radius" | "corner" | "rotate";

export function PhotoAnnotationEditor({
  photoUrl,
  photoId,
  existingAnnotations = [],
  onSave,
  onCancel,
  onDelete,
}: PhotoAnnotationEditorProps) {
  // Add skipAuth query param in dev mode for images (but not for blob URLs)
  const imageUrl = photoUrl && sessionStorage.getItem('skipAuth') === 'true' && !photoUrl.startsWith('blob:')
    ? `${photoUrl}?skipAuth=true`
    : photoUrl;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(existingAnnotations);
  const [history, setHistory] = useState<Annotation[][]>([existingAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<"text" | "arrow" | "line" | "circle" | "pen" | "measurement" | "select" | null>(null);
  const [selectedColor, setSelectedColor] = useState("#3b82f6"); // Default to blue
  const [colorPickerExpanded, setColorPickerExpanded] = useState(false); // Collapsed by default
  const [strokeWidth, setStrokeWidth] = useState(strokeSizes[1].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [measurementFeet, setMeasurementFeet] = useState("");
  const [measurementInches, setMeasurementInches] = useState("");
  const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialAnnoState, setInitialAnnoState] = useState<Annotation | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>("default");
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [zoomCirclePos, setZoomCirclePos] = useState<{ x: number; y: number } | null>(null);
  
  // Multi-touch gesture state
  const [isMultiTouch, setIsMultiTouch] = useState(false);
  const [initialTouchDistance, setInitialTouchDistance] = useState<number | null>(null);
  const [initialTouchAngle, setInitialTouchAngle] = useState<number | null>(null);
  const [initialGestureScale, setInitialGestureScale] = useState<number | null>(null);
  const [initialGestureRotation, setInitialGestureRotation] = useState<number | null>(null);
  
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
    if (!canvasRef.current || !imageRef.current || !imageUrl) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleImageLoad = () => {
      // Use original image dimensions for canvas - let CSS handle display sizing
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;
      
      canvas.width = width;
      canvas.height = height;
      redrawCanvas();
    };

    const handleImageError = () => {
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

    // Always set handlers first
    img.onload = handleImageLoad;
    img.onerror = handleImageError;

    // Then set/update the src - this ensures handlers are in place before loading starts
    if (img.src !== imageUrl) {
      img.src = imageUrl;
    } else if (img.complete && img.naturalWidth > 0) {
      // Image already loaded (e.g., cached)
      handleImageLoad();
    } else if (img.complete && img.naturalWidth === 0) {
      // Image complete but failed to load
      handleImageError();
    }

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

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
            
            // Draw text with bold black outline (no background box)
            ctx.lineWidth = Math.max(fontSize / 8, 4); // Thick black outline
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(annotation.content, 0, 0);
            
            // Draw colored text fill
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
            const scaledLineWidth = annotation.strokeWidth * lineScaleFactor;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline first
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledLineWidth + 6; // Thicker for black outline
            ctx.beginPath();
            ctx.moveTo(annotation.position.x, annotation.position.y);
            ctx.lineTo(annotation.position.x2, annotation.position.y2);
            ctx.stroke();
            
            // Draw colored line on top
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledLineWidth;
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
            const scaledCircleWidth = annotation.strokeWidth * circleScaleFactor;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline first
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledCircleWidth + 6; // Thicker for black outline
            ctx.beginPath();
            ctx.arc(
              centerX,
              centerY,
              annotation.position.width,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            
            // Draw colored circle on top
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledCircleWidth;
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
            const scaledPenWidth = annotation.strokeWidth * penScaleFactor;
            const points = annotation.position.points;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline first
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledPenWidth + 6; // Thicker for black outline
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            // Draw colored pen stroke on top
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledPenWidth;
            ctx.beginPath();
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
        case "measurement":
          if (annotation.feet !== undefined && annotation.inches !== undefined && annotation.position.x !== undefined) {
            const fontSize = annotation.fontSize || 20;
            const rotation = annotation.rotation || 0;
            const scale = annotation.scale || 1;
            
            // Create measurement text (always show both feet and inches)
            const feet = annotation.feet || 0;
            const inches = annotation.inches || 0;
            const measurementText = `${feet}'${inches}"`;
            
            ctx.save();
            
            // Apply transformations
            ctx.translate(annotation.position.x, annotation.position.y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            
            // Measure text to determine line length
            ctx.font = `bold ${fontSize}px Arial`;
            const textMetrics = ctx.measureText(measurementText);
            const textWidth = textMetrics.width;
            const lineLength = Math.max(textWidth + 80, 200); // Line extends beyond text
            const capHeight = 20; // Height of end caps
            
            const measureScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            const scaledMeasureWidth = annotation.strokeWidth * measureScaleFactor;
            
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline for horizontal line
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledMeasureWidth + 6;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, 0);
            ctx.lineTo(lineLength / 2, 0);
            ctx.stroke();
            
            // Draw colored horizontal line
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledMeasureWidth;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, 0);
            ctx.lineTo(lineLength / 2, 0);
            ctx.stroke();
            
            // Draw black outline for left end cap
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledMeasureWidth + 6;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, -capHeight / 2);
            ctx.lineTo(-lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw colored left end cap
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledMeasureWidth;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, -capHeight / 2);
            ctx.lineTo(-lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw black outline for right end cap
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledMeasureWidth + 6;
            ctx.beginPath();
            ctx.moveTo(lineLength / 2, -capHeight / 2);
            ctx.lineTo(lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw colored right end cap
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledMeasureWidth;
            ctx.beginPath();
            ctx.moveTo(lineLength / 2, -capHeight / 2);
            ctx.lineTo(lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw measurement text with black outline
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = Math.max(fontSize / 8, 4);
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(measurementText, 0, -capHeight - fontSize / 2);
            
            // Draw colored text
            ctx.fillStyle = annotation.color;
            ctx.fillText(measurementText, 0, -capHeight - fontSize / 2);
            
            ctx.restore();
            
            // Draw handles if selected (outside transformation)
            if (isSelected) {
              ctx.save();
              ctx.translate(annotation.position.x, annotation.position.y);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.scale(scale, scale);
              
              // Scale handle (right side)
              drawHandle(ctx, lineLength / 2, 0, "#3b82f6");
              // Rotation handle (top center)
              drawHandle(ctx, 0, -capHeight - fontSize / 2 - 30, "#22c55e");
              
              ctx.restore();
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
    ctx.arc(x, y, 12, 0, 2 * Math.PI); // Larger visual handle (12px radius) for better visibility
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
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    // Arrowhead proportions - larger and more prominent
    const headLength = Math.max(thickerLineWidth * 2.5, 30); // Minimum 30px for visibility
    const headWidth = thickerLineWidth * 1.2; // Width extends beyond shaft
    
    // Calculate where shaft meets arrowhead (shaft stops here)
    const shaftEndX = toX - headLength * Math.cos(angle);
    const shaftEndY = toY - headLength * Math.sin(angle);
    
    // Calculate arrowhead points that extend past the shaft
    const perpAngle = angle + Math.PI / 2;
    const point1X = shaftEndX + headWidth * Math.cos(perpAngle);
    const point1Y = shaftEndY + headWidth * Math.sin(perpAngle);
    const point2X = shaftEndX - headWidth * Math.cos(perpAngle);
    const point2Y = shaftEndY - headWidth * Math.sin(perpAngle);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw black outline for shaft
    ctx.lineWidth = thickerLineWidth + 6;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(shaftEndX, shaftEndY);
    ctx.stroke();

    // Draw colored shaft
    ctx.lineWidth = thickerLineWidth;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(shaftEndX, shaftEndY);
    ctx.stroke();

    // Draw black outline for arrowhead (filled triangle)
    ctx.beginPath();
    ctx.moveTo(toX, toY); // Tip
    ctx.lineTo(point1X, point1Y); // One side
    ctx.lineTo(point2X, point2Y); // Other side
    ctx.closePath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Draw colored arrowhead on top
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(point1X, point1Y);
    ctx.lineTo(point2X, point2Y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  const getHandleAtPoint = (anno: Annotation, x: number, y: number): ResizeHandle | null => {
    const handleSize = 40; // Larger hit area for easier selection (40px diameter = 20px radius)
    
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
      case "measurement":
        if (anno.feet !== undefined && anno.inches !== undefined) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (ctx) {
            const fontSize = anno.fontSize || 20;
            const rotation = anno.rotation || 0;
            const scale = anno.scale || 1;
            
            // Create measurement text
            let measurementText = "";
            if (anno.feet > 0) {
              measurementText = `${anno.feet}'`;
            }
            if (anno.inches > 0) {
              measurementText += `${anno.inches}"`;
            }
            if (!measurementText) {
              measurementText = "0\"";
            }
            
            ctx.font = `bold ${fontSize}px Arial`;
            const textMetrics = ctx.measureText(measurementText);
            const textWidth = textMetrics.width;
            const lineLength = Math.max(textWidth + 80, 200);
            const capHeight = 20;
            
            // Transform point to measurement's local coordinate system
            const dx = x - anno.position.x;
            const dy = y - anno.position.y;
            const rad = (-rotation * Math.PI) / 180;
            const localX = (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale;
            const localY = (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale;
            
            // Check rotation handle (top center, above text)
            const rotateHandleX = 0;
            const rotateHandleY = -capHeight - fontSize / 2 - 30;
            const distanceToRotate = Math.sqrt(
              Math.pow(localX - rotateHandleX, 2) + Math.pow(localY - rotateHandleY, 2)
            );
            if (distanceToRotate <= handleSize / 2) {
              return "rotate";
            }
            
            // Check scale handle (right side of line)
            const scaleHandleX = lineLength / 2;
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
        case "measurement":
          if (anno.feet !== undefined && anno.inches !== undefined) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (ctx) {
              const fontSize = anno.fontSize || 20;
              const rotation = anno.rotation || 0;
              const scale = anno.scale || 1;
              
              // Create measurement text
              let measurementText = "";
              if (anno.feet > 0) {
                measurementText = `${anno.feet}'`;
              }
              if (anno.inches > 0) {
                measurementText += `${anno.inches}"`;
              }
              if (!measurementText) {
                measurementText = "0\"";
              }
              
              ctx.font = `bold ${fontSize}px Arial`;
              const textMetrics = ctx.measureText(measurementText);
              const textWidth = textMetrics.width;
              const lineLength = Math.max(textWidth + 80, 200);
              const capHeight = 20;
              
              // Transform click point to measurement's local coordinate system
              const dx = x - anno.position.x;
              const dy = y - anno.position.y;
              const rad = (-rotation * Math.PI) / 180;
              const localX = (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale;
              const localY = (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale;
              
              // Check if click is within measurement bounds (line + text area)
              const padding = 15;
              if (
                localX >= -lineLength / 2 - padding &&
                localX <= lineLength / 2 + padding &&
                localY >= -capHeight - fontSize - padding &&
                localY <= capHeight + padding
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
              const arrowheadSize = thickerLineWidth * 1.5;
              
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

    // Keep text annotations selected until "Done" is pressed
    const selectedAnno = annotations.find(a => a.id === selectedAnnotation);
    if (selectedAnno?.type !== "text") {
      setSelectedAnnotation(null);
    }

    // Don't create new annotations if no tool is selected
    if (!tool) return;

    setIsCreating(true);
    setStartPos({ x, y });

    // Text and measurement tools now use dialog, not inline positioning
    if (tool === "text" || tool === "measurement") {
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
              // Scale limits: min 0.6x (24px with 40px base) to max 4x (160px with 40px base)
              const newScale = Math.max(0.6, Math.min(4, currentScale * scaleFactor));
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
          case "measurement":
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

    if (isCreating && startPos && tool && tool !== "text" && tool !== "measurement" && tool !== "pen" && tool !== "select") {
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

    if (isCreating && tempAnnotation && tool && tool !== "text" && tool !== "measurement") {
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

    // Detect multi-touch gestures (2 fingers)
    if (e.touches.length === 2 && selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      // Only enable multi-touch for text annotations
      if (anno && anno.type === "text") {
        setIsMultiTouch(true);
        
        // Calculate initial distance between fingers
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        setInitialTouchDistance(distance);
        
        // Calculate initial angle between fingers
        const angle = Math.atan2(
          touch2.clientY - touch1.clientY,
          touch2.clientX - touch1.clientX
        );
        setInitialTouchAngle(angle);
        
        // Store initial scale and rotation
        setInitialGestureScale(anno.scale || 1);
        setInitialGestureRotation(anno.rotation || 0);
        
        return;
      }
    }

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

    // Keep text annotations selected until "Done" is pressed
    const selectedAnno = annotations.find(a => a.id === selectedAnnotation);
    if (selectedAnno?.type !== "text") {
      setSelectedAnnotation(null);
    }

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

    // Handle 2-finger pinch-to-scale and twist-to-rotate gestures
    if (isMultiTouch && e.touches.length === 2 && selectedAnnotation && initialTouchDistance !== null && initialTouchAngle !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      // Calculate current distance (for pinch-to-scale)
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      // Calculate current angle (for twist-to-rotate)
      const currentAngle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );
      
      // Calculate scale factor (pinch)
      const scaleFactor = currentDistance / initialTouchDistance;
      const newScale = Math.max(0.6, Math.min(4, (initialGestureScale || 1) * scaleFactor));
      
      // Calculate rotation delta (twist) in degrees
      const angleDelta = (currentAngle - initialTouchAngle) * (180 / Math.PI);
      let newRotation = (initialGestureRotation || 0) + angleDelta;
      
      // Normalize rotation to -180 to 180
      while (newRotation > 180) newRotation -= 360;
      while (newRotation < -180) newRotation += 360;
      
      // Apply transformations
      const updatedAnnotations = annotations.map(a => {
        if (a.id !== selectedAnnotation || a.type !== "text") return a;
        
        return {
          ...a,
          scale: newScale,
          rotation: newRotation,
        };
      });
      
      setAnnotations(updatedAnnotations);
      return;
    }

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
              // Scale limits: min 0.6x (24px with 40px base) to max 4x (160px with 40px base)
              const newScale = Math.max(0.6, Math.min(4, currentScale * scaleFactor));
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
          case "measurement":
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

    if (isCreating && startPos && tool && tool !== "text" && tool !== "measurement" && tool !== "pen" && tool !== "select") {
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
    // Handle multi-touch gesture end
    if (isMultiTouch && selectedAnnotation) {
      addToHistory([...annotations]);
      setIsMultiTouch(false);
      setInitialTouchDistance(null);
      setInitialTouchAngle(null);
      setInitialGestureScale(null);
      setInitialGestureRotation(null);
      return;
    }

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

    if (isCreating && tempAnnotation && tool && tool !== "text" && tool !== "measurement") {
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
      fontSize: Math.max(32, 40 + strokeWidth * 2), // Larger default for better readability
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

  const handleAddMeasurementFromDialog = () => {
    if (!canvasRef.current) return;
    
    const feet = parseInt(measurementFeet) || 0;
    const inches = parseInt(measurementInches) || 0;
    
    if (feet === 0 && inches === 0) return;

    // Place measurement in the center of the canvas
    const centerX = canvasRef.current.width / 2;
    const centerY = canvasRef.current.height / 2;

    const newAnnotation: Annotation = {
      id: `anno-${Date.now()}`,
      type: "measurement",
      feet,
      inches,
      color: selectedColor,
      strokeWidth,
      fontSize: Math.max(32, 40 + strokeWidth * 2),
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
    
    // Auto-select the new measurement so user can immediately reposition it
    setSelectedAnnotation(newAnnotation.id);
    setTool("select");
    
    // Close dialog and clear inputs
    setMeasurementDialogOpen(false);
    setMeasurementFeet("");
    setMeasurementInches("");
  };

  const handleDeleteSelected = () => {
    console.log("[PhotoEdit] Delete button clicked, selectedAnnotation:", selectedAnnotation);
    if (selectedAnnotation) {
      const newAnnotations = annotations.filter(a => a.id !== selectedAnnotation);
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
      setSelectedAnnotation(null);
      toast({
        title: "Annotation deleted",
        description: "The selected annotation has been removed",
      });
    } else {
      console.log("[PhotoEdit] Delete clicked but no annotation selected");
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

  const handleSave = async () => {
    // Render final annotated image to canvas
    const canvas = canvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !image) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw everything - photo + annotations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw all annotations (same logic as redrawCanvas but without selection handles)
    annotations.forEach((annotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = annotation.strokeWidth;

      switch (annotation.type) {
        case "text":
          if (annotation.content && annotation.position.x !== undefined) {
            const fontSize = annotation.fontSize || 40;
            const rotation = annotation.rotation || 0;
            const scale = annotation.scale || 1;
            
            ctx.save();
            ctx.translate(annotation.position.x, annotation.position.y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            
            ctx.font = `${fontSize}px Arial`;
            
            // Draw text with bold black outline (no background box)
            ctx.lineWidth = Math.max(fontSize / 8, 4);
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(annotation.content, 0, 0);
            
            // Draw colored text fill
            ctx.fillStyle = annotation.color;
            ctx.fillText(annotation.content, 0, 0);
            ctx.restore();
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
          }
          break;
        case "line":
          if (
            annotation.position.x !== undefined &&
            annotation.position.y !== undefined &&
            annotation.position.x2 !== undefined &&
            annotation.position.y2 !== undefined
          ) {
            const lineScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            const scaledLineWidth = annotation.strokeWidth * lineScaleFactor;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline first
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledLineWidth + 6;
            ctx.beginPath();
            ctx.moveTo(annotation.position.x, annotation.position.y);
            ctx.lineTo(annotation.position.x2, annotation.position.y2);
            ctx.stroke();
            
            // Draw colored line on top
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledLineWidth;
            ctx.beginPath();
            ctx.moveTo(annotation.position.x, annotation.position.y);
            ctx.lineTo(annotation.position.x2, annotation.position.y2);
            ctx.stroke();
          }
          break;
        case "circle":
          if (
            annotation.position.x !== undefined &&
            annotation.position.y !== undefined &&
            annotation.position.width !== undefined
          ) {
            const centerX = annotation.position.x2 !== undefined 
              ? (annotation.position.x + annotation.position.x2) / 2
              : annotation.position.x;
            const centerY = annotation.position.y2 !== undefined
              ? (annotation.position.y + annotation.position.y2) / 2
              : annotation.position.y;
            
            const circleScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            const scaledCircleWidth = annotation.strokeWidth * circleScaleFactor;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline first
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledCircleWidth + 6;
            ctx.beginPath();
            ctx.arc(
              centerX,
              centerY,
              annotation.position.width,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            
            // Draw colored circle on top
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledCircleWidth;
            ctx.beginPath();
            ctx.arc(
              centerX,
              centerY,
              annotation.position.width,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          }
          break;
        case "pen":
          if (annotation.position.points && annotation.position.points.length > 0) {
            const penScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            const scaledPenWidth = annotation.strokeWidth * penScaleFactor;
            const points = annotation.position.points;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline first
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledPenWidth + 6;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            // Draw colored pen stroke on top
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledPenWidth;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
          }
          break;
        case "measurement":
          if (annotation.feet !== undefined && annotation.inches !== undefined && annotation.position.x !== undefined) {
            const fontSize = annotation.fontSize || 40;
            const rotation = annotation.rotation || 0;
            const scale = annotation.scale || 1;
            
            // Create measurement text (always show both feet and inches)
            const feet = annotation.feet || 0;
            const inches = annotation.inches || 0;
            const measurementText = `${feet}'${inches}"`;
            
            ctx.save();
            ctx.translate(annotation.position.x, annotation.position.y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            
            // Measure text to determine line length
            ctx.font = `bold ${fontSize}px Arial`;
            const textMetrics = ctx.measureText(measurementText);
            const textWidth = textMetrics.width;
            const lineLength = Math.max(textWidth + 80, 200);
            const capHeight = 20;
            
            const measureScaleFactor = annotation.strokeWidth >= 8 ? 4.5 : 1.5;
            const scaledMeasureWidth = annotation.strokeWidth * measureScaleFactor;
            
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // Draw black outline for horizontal line
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledMeasureWidth + 6;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, 0);
            ctx.lineTo(lineLength / 2, 0);
            ctx.stroke();
            
            // Draw colored horizontal line
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledMeasureWidth;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, 0);
            ctx.lineTo(lineLength / 2, 0);
            ctx.stroke();
            
            // Draw black outline for left end cap
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledMeasureWidth + 6;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, -capHeight / 2);
            ctx.lineTo(-lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw colored left end cap
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledMeasureWidth;
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, -capHeight / 2);
            ctx.lineTo(-lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw black outline for right end cap
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = scaledMeasureWidth + 6;
            ctx.beginPath();
            ctx.moveTo(lineLength / 2, -capHeight / 2);
            ctx.lineTo(lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw colored right end cap
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = scaledMeasureWidth;
            ctx.beginPath();
            ctx.moveTo(lineLength / 2, -capHeight / 2);
            ctx.lineTo(lineLength / 2, capHeight / 2);
            ctx.stroke();
            
            // Draw measurement text with black outline
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = Math.max(fontSize / 8, 4);
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(measurementText, 0, -capHeight - fontSize / 2);
            
            // Draw colored text
            ctx.fillStyle = annotation.color;
            ctx.fillText(measurementText, 0, -capHeight - fontSize / 2);
            
            ctx.restore();
          }
          break;
      }
    });

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onSave(annotations, blob);
      }
    }, 'image/jpeg', 0.92);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-muted/30 pointer-events-none">
      {/* Canvas - Fill available space above bottom UI */}
      <div className="absolute inset-x-0 top-16 bottom-32 flex items-center justify-center pointer-events-none">
        <img
          ref={imageRef}
          alt="Photo to annotate"
          className="hidden"
          {...(imageUrl && !imageUrl.startsWith('blob:') ? { crossOrigin: 'use-credentials' } : {})}
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
          className="touch-none pointer-events-auto"
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

      {/* Color Picker - Right side, aligned with S/M/L tabs height */}
      <div className="fixed bottom-20 right-4 z-[60] pb-2">
        {/* Expanded Color Palette - Floating above toggle button */}
        {colorPickerExpanded && (
          <div 
            className="absolute bottom-14 right-0 flex flex-col gap-2 py-4 max-h-[300px] overflow-y-auto pointer-events-auto"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
            }}
          >
            {colors.map((color) => (
              <button
                key={color.value}
                onClick={() => {
                  console.log("[PhotoEdit] Color selected:", color.name, color.value);
                  setSelectedColor(color.value);
                  setColorPickerExpanded(false); // Auto-collapse after selection
                }}
                className={`w-10 h-10 rounded-full border hover-elevate transition-all flex-shrink-0 shadow-lg ${
                  selectedColor === color.value ? 'border-white border-2 ring-2 ring-white/50' : 'border-white/40 border-2'
                }`}
                style={{ backgroundColor: color.value }}
                data-testid={`button-color-${color.name.toLowerCase()}`}
                aria-label={`Color ${color.name}`}
              />
            ))}
          </div>
        )}
        
        {/* Fixed Toggle Button - Same height as S/M/L tabs */}
        <button
          onClick={() => {
            console.log("[PhotoEdit] Color picker toggle clicked, expanded:", colorPickerExpanded);
            setColorPickerExpanded(!colorPickerExpanded);
          }}
          className="w-12 h-12 rounded-full border-2 border-white hover-elevate transition-all flex items-center justify-center relative shadow-lg pointer-events-auto"
          style={{ backgroundColor: selectedColor }}
          data-testid="button-toggle-color-picker"
          aria-label={colorPickerExpanded ? "Collapse color picker" : "Expand color picker"}
        >
          {colorPickerExpanded ? (
            <ChevronDown className="w-5 h-5 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
          ) : (
            <ChevronUp className="w-5 h-5 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
          )}
        </button>
      </div>


      {/* Fixed Cancel and Save Buttons - Top Corners */}
      <div className="fixed top-4 left-4 z-50 pointer-events-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          data-testid="button-cancel"
          className="rounded-full hover-elevate w-12 h-12 bg-black/80 backdrop-blur-md text-white"
          aria-label="Cancel"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>
      <div className="fixed top-4 right-4 z-50 pointer-events-auto">
        <Button
          size="icon"
          onClick={handleSave}
          data-testid="button-save-annotations"
          className="rounded-full hover-elevate w-12 h-12 bg-primary text-primary-foreground shadow-lg"
          aria-label="Save"
        >
          <Check className="w-6 h-6" />
        </Button>
      </div>

      {/* Fixed Size Tabs Above Bottom Toolbar */}
      <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center pb-2 px-2 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md rounded-full px-2 py-1.5 shadow-lg flex items-center gap-1">
          {strokeSizes.map((size) => (
            <button
              key={size.value}
              onClick={() => setStrokeWidth(size.value)}
              data-testid={`button-size-${size.name.toLowerCase()}`}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                strokeWidth === size.value 
                  ? 'bg-white text-black' 
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              aria-label={`Size ${size.name}`}
            >
              {size.name}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Done Button - appears when text annotation is selected */}
      {selectedAnnotation && annotations.find(a => a.id === selectedAnnotation)?.type === "text" && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 pb-2 pointer-events-auto">
          <Button
            onClick={() => setSelectedAnnotation(null)}
            data-testid="button-done-editing-text"
            className="rounded-full hover-elevate px-8 py-3 bg-primary text-primary-foreground shadow-xl text-lg font-semibold"
            aria-label="Done editing text"
          >
            Done
          </Button>
        </div>
      )}

      {/* Bottom Toolbar - Non-scrollable Tools */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pb-safe px-2 pointer-events-auto">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-3 py-2 shadow-lg flex items-center gap-1.5">
          {/* Tool Buttons */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTextDialogOpen(true)}
            data-testid="button-tool-text"
            className="rounded-full hover-elevate w-10 h-10 text-white flex-shrink-0"
            aria-label="Add text"
          >
            <Type className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "arrow" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "arrow" ? null : "arrow")}
            data-testid="button-tool-arrow"
            className={`rounded-full w-10 h-10 flex-shrink-0 ${tool === "arrow" ? "hover-elevate" : "text-white hover-elevate"}`}
            aria-label="Arrow tool"
          >
            <ArrowUpRight className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "line" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "line" ? null : "line")}
            data-testid="button-tool-line"
            className={`rounded-full w-10 h-10 flex-shrink-0 ${tool === "line" ? "hover-elevate" : "text-white hover-elevate"}`}
            aria-label="Line tool"
          >
            <Minus className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "circle" ? null : "circle")}
            data-testid="button-tool-circle"
            className={`rounded-full w-10 h-10 flex-shrink-0 ${tool === "circle" ? "hover-elevate" : "text-white hover-elevate"}`}
            aria-label="Circle tool"
          >
            <Circle className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === "pen" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool(tool === "pen" ? null : "pen")}
            data-testid="button-tool-pen"
            className={`rounded-full w-10 h-10 flex-shrink-0 ${tool === "pen" ? "hover-elevate" : "text-white hover-elevate"}`}
            aria-label="Pen tool"
          >
            <Pen className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMeasurementDialogOpen(true)}
            data-testid="button-tool-measurement"
            className="rounded-full hover-elevate w-10 h-10 text-white flex-shrink-0"
            aria-label="Tape measure"
          >
            <Ruler className="w-5 h-5" />
          </Button>

          <div className="h-6 w-px bg-white/20 mx-0.5" />

          {/* Actions */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            data-testid="button-undo"
            className="rounded-full hover-elevate w-10 h-10 text-white flex-shrink-0"
            aria-label="Undo"
          >
            <Undo className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={selectedAnnotation ? handleDeleteSelected : onDelete}
            data-testid="button-delete"
            className="rounded-full hover-elevate w-10 h-10 text-white flex-shrink-0"
            aria-label={selectedAnnotation ? "Delete annotation" : "Delete photo"}
          >
            <Trash2 className="w-5 h-5" />
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

      {/* Measurement Input Dialog */}
      <Dialog open={measurementDialogOpen} onOpenChange={setMeasurementDialogOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Add Measurement</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-1 block">Feet</label>
                <Input
                  type="number"
                  min="0"
                  value={measurementFeet}
                  onChange={(e) => setMeasurementFeet(e.target.value)}
                  placeholder="0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (measurementFeet || measurementInches)) {
                      handleAddMeasurementFromDialog();
                    } else if (e.key === "Escape") {
                      setMeasurementDialogOpen(false);
                      setMeasurementFeet("");
                      setMeasurementInches("");
                    }
                  }}
                  autoFocus
                  data-testid="input-measurement-feet"
                  className="text-base"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-1 block">Inches</label>
                <Input
                  type="number"
                  min="0"
                  max="11"
                  value={measurementInches}
                  onChange={(e) => setMeasurementInches(e.target.value)}
                  placeholder="0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (measurementFeet || measurementInches)) {
                      handleAddMeasurementFromDialog();
                    } else if (e.key === "Escape") {
                      setMeasurementDialogOpen(false);
                      setMeasurementFeet("");
                      setMeasurementInches("");
                    }
                  }}
                  data-testid="input-measurement-inches"
                  className="text-base"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setMeasurementDialogOpen(false);
                setMeasurementFeet("");
                setMeasurementInches("");
              }}
              data-testid="button-cancel-measurement"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMeasurementFromDialog}
              disabled={!measurementFeet && !measurementInches}
              data-testid="button-submit-measurement"
            >
              Add Measurement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
