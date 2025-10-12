import { useState, useRef, useEffect } from "react";
import { Type, ArrowRight, Minus, Circle, Trash2, Download, Palette, Undo, Pen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Annotation {
  id: string;
  type: "text" | "arrow" | "line" | "circle" | "pen";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
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
  { name: "XS", value: 2 },
  { name: "S", value: 4 },
  { name: "M", value: 6 },
  { name: "L", value: 10 },
];

interface PhotoAnnotationEditorProps {
  photoUrl: string;
  photoId: string;
  existingAnnotations?: Annotation[];
  onSave: (annotations: Annotation[]) => void;
}

type ResizeHandle = "start" | "end" | "radius" | "corner";

export function PhotoAnnotationEditor({
  photoUrl,
  photoId,
  existingAnnotations = [],
  onSave,
}: PhotoAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(existingAnnotations);
  const [history, setHistory] = useState<Annotation[][]>([existingAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<"text" | "arrow" | "line" | "circle" | "pen" | null>(null);
  const [selectedColor, setSelectedColor] = useState(colors[0].value);
  const [strokeWidth, setStrokeWidth] = useState(strokeSizes[1].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<{ canvasX: number; canvasY: number; screenX: number; screenY: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialAnnoState, setInitialAnnoState] = useState<Annotation | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>("default");
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

    // Check if image is already loaded (from JSX src prop)
    if (img.complete && img.naturalWidth > 0) {
      handleImageLoad();
    } else if (img.complete && img.naturalWidth === 0) {
      // Image failed to load, but still initialize canvas with default dimensions
      console.warn("Image failed to load, using default canvas dimensions:", photoUrl);
      canvas.width = 800;
      canvas.height = 600;
      // Fill with gray background to indicate missing image
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Image failed to load", 400, 300);
    } else {
      // Otherwise wait for load event
      img.onload = handleImageLoad;
      img.onerror = (e) => {
        console.error("Failed to load photo for annotation:", photoUrl);
        // Still initialize canvas with default dimensions
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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image if loaded, otherwise draw fallback background
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0);
    } else {
      // Draw fallback background for failed image
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Image failed to load - annotations still work", canvas.width / 2, canvas.height / 2);
    }

    // Combine permanent annotations with temp annotation for rendering
    const allAnnotations = tempAnnotation 
      ? [...annotations, tempAnnotation]
      : annotations;

    allAnnotations.forEach((annotation) => {
      const isSelected = selectedAnnotation === annotation.id;
      const isTemp = annotation.id === tempAnnotation?.id;
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = annotation.strokeWidth;
      
      // Make temp annotation slightly transparent to show it's a preview
      if (isTemp) {
        ctx.globalAlpha = 0.7;
      }

      switch (annotation.type) {
        case "text":
          if (annotation.content && annotation.position.x !== undefined) {
            const fontSize = annotation.fontSize || 20;
            ctx.font = `${fontSize}px Arial`;
            
            // Measure text to draw background box
            const textMetrics = ctx.measureText(annotation.content);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            const padding = 8;
            const borderRadius = 6;
            
            // Draw rounded semi-transparent background box
            const boxX = annotation.position.x - padding;
            const boxY = annotation.position.y - textHeight - padding;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = textHeight + padding * 2;
            
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black background
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
            ctx.fill();
            ctx.restore();
            
            // Draw text over background
            ctx.fillStyle = annotation.color;
            ctx.fillText(annotation.content, annotation.position.x, annotation.position.y);
            
            // Draw selection handles for text if selected
            if (isSelected) {
              // Corner handle for resize (blue)
              drawHandle(ctx, annotation.position.x + textWidth, annotation.position.y, "#3b82f6");
              // Center handle for move (blue)
              drawHandle(ctx, annotation.position.x + textWidth / 2, annotation.position.y - textHeight / 2, "#3b82f6");
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
            ctx.beginPath();
            ctx.arc(
              annotation.position.x,
              annotation.position.y,
              annotation.position.width,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            if (isSelected) {
              const radius = annotation.position.width;
              // Draw resize handle on right edge (blue)
              drawHandle(ctx, annotation.position.x + radius, annotation.position.y, "#3b82f6");
              // Draw move handle at center (blue)
              drawHandle(ctx, annotation.position.x, annotation.position.y, "#3b82f6");
            }
          }
          break;
        case "pen":
          if (annotation.position.points && annotation.position.points.length > 0) {
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = annotation.strokeWidth;
            ctx.beginPath();
            const points = annotation.position.points;
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            // Draw handles at start and end if selected
            if (isSelected && points.length > 0) {
              drawHandle(ctx, points[0].x, points[0].y, "#3b82f6");
              drawHandle(ctx, points[points.length - 1].x, points[points.length - 1].y, "#3b82f6");
            }
          }
          break;
      }
      
      // Reset alpha after temp annotation
      if (isTemp) {
        ctx.globalAlpha = 1.0;
      }
    });
  };

  const drawHandle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    // Draw outer white circle for visibility
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw inner colored circle
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
    // Make arrows thicker and more prominent
    const thickerLineWidth = lineWidth * 1.5;
    const arrowLength = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    
    // Arrowhead should be visible - minimum 15px
    const headLength = Math.max(15, Math.min(thickerLineWidth * 3, arrowLength * 0.35));
    const angle = Math.atan2(toY - fromY, toX - fromX);

    console.log("Drawing arrow:", { fromX, fromY, toX, toY, headLength, color, lineWidth: thickerLineWidth });

    // Draw thick arrow shaft
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = thickerLineWidth;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw filled arrowhead with simpler triangle
    ctx.beginPath();
    ctx.moveTo(toX, toY); // Arrow tip
    
    // Left wing
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    
    // Right wing  
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    console.log("Arrowhead drawn with fillStyle:", color);
  };

  const getHandleAtPoint = (anno: Annotation, x: number, y: number): ResizeHandle | null => {
    const handleSize = 16; // Increased for larger circular handles
    
    switch (anno.type) {
      case "text":
        if (anno.content) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (ctx) {
            const fontSize = anno.fontSize || 20;
            ctx.font = `${fontSize}px Arial`;
            const textMetrics = ctx.measureText(anno.content);
            const textWidth = textMetrics.width;
            // Check corner resize handle using circular distance
            const cornerX = anno.position.x + textWidth;
            const cornerY = anno.position.y;
            const distanceToCorner = Math.sqrt(
              Math.pow(x - cornerX, 2) + Math.pow(y - cornerY, 2)
            );
            if (distanceToCorner <= handleSize / 2) {
              return "corner";
            }
          }
        }
        break;
      case "arrow":
      case "line":
        if (anno.position.x2 !== undefined && anno.position.y2 !== undefined) {
          // Check start handle using circular distance
          const distanceToStart = Math.sqrt(
            Math.pow(x - anno.position.x, 2) + Math.pow(y - anno.position.y, 2)
          );
          if (distanceToStart <= handleSize / 2) {
            return "start";
          }
          // Check end handle using circular distance
          const distanceToEnd = Math.sqrt(
            Math.pow(x - anno.position.x2, 2) + Math.pow(y - anno.position.y2, 2)
          );
          if (distanceToEnd <= handleSize / 2) {
            return "end";
          }
        }
        break;
      case "circle":
        if (anno.position.width !== undefined) {
          const radius = anno.position.width;
          const handleX = anno.position.x + radius;
          const handleY = anno.position.y;
          // Check radius handle using circular distance
          const distanceToHandle = Math.sqrt(
            Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2)
          );
          if (distanceToHandle <= handleSize / 2) {
            return "radius";
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
              ctx.font = `${fontSize}px Arial`;
              const textMetrics = ctx.measureText(anno.content);
              const textWidth = textMetrics.width;
              const textHeight = fontSize;
              
              if (
                x >= anno.position.x &&
                x <= anno.position.x + textWidth &&
                y >= anno.position.y - textHeight &&
                y <= anno.position.y
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
          }
          break;
        case "circle":
          if (anno.position.width !== undefined) {
            const distance = Math.sqrt(
              Math.pow(x - anno.position.x, 2) + Math.pow(y - anno.position.y, 2)
            );
            const tolerance = 10;
            if (Math.abs(distance - anno.position.width) < tolerance) {
              return anno;
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

  const updateCursor = (x: number, y: number) => {
    // When actively dragging/resizing, show grabbing/pinch cursors
    if (isDragging) {
      setCursorStyle("grabbing");
      return;
    }
    if (isResizing) {
      setCursorStyle("grabbing"); // Pinching effect
      return;
    }

    // Check if hovering over selected annotation's handle
    if (selectedAnnotation) {
      const anno = annotations.find(a => a.id === selectedAnnotation);
      if (anno) {
        const handle = getHandleAtPoint(anno, x, y);
        if (handle) {
          setCursorStyle("grab"); // Will show pinching fingers
          return;
        }
      }
    }

    // Check if hovering over any annotation body
    const clickedAnno = getClickedAnnotation(x, y);
    if (clickedAnno) {
      setCursorStyle("grab"); // Open hand for move
      return;
    }

    // Default cursor
    setCursorStyle(tool ? "crosshair" : "default");
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoordinates(e);
    // For text overlay positioning, use coordinates relative to the canvas parent wrapper
    // which is position:relative, not the canvas itself
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const parentRect = canvasRef.current.parentElement?.getBoundingClientRect();
    const displayX = parentRect ? e.clientX - parentRect.left : e.clientX - canvasRect.left;
    const displayY = parentRect ? e.clientY - parentRect.top : e.clientY - canvasRect.top;

    // Check if clicking on a selected annotation's handle
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

    // Deselect if clicking empty space
    setSelectedAnnotation(null);

    if (!tool) return;

    // Start creating annotation with click-and-drag
    setIsCreating(true);
    setStartPos({ x, y });

    if (tool === "text") {
      // Use canvas coordinates for drawing, display coordinates for input overlay
      const newTextPos = { canvasX: x, canvasY: y, screenX: displayX, screenY: displayY };
      console.log("Text tool clicked - setting textPosition to:", newTextPos);
      setTextPosition(newTextPos);
      setIsCreating(false);
      setTextInput(""); // Clear any previous text
      console.log("Text position state should now be set");
    } else if (tool === "pen") {
      // For pen, start recording path points
      const tempAnno: Annotation = {
        id: `temp-${Date.now()}`,
        type: "pen",
        color: selectedColor,
        strokeWidth: strokeWidth,
        position: {
          x, y, // Store first point in x,y for compatibility
          points: [{ x, y }]
        },
      };
      setTempAnnotation(tempAnno);
    } else {
      // For arrow, line, circle - create temp annotation starting at this point
      const tempAnno: Annotation = {
        id: `temp-${Date.now()}`,
        type: tool,
        color: selectedColor,
        strokeWidth: strokeWidth,
        fontSize: 20 + strokeWidth * 3,
        position: 
          tool === "circle"
            ? { x, y, width: 1 }
            : { x, y, x2: x, y2: y },
      };
      setTempAnnotation(tempAnno);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoordinates(e);

    // Always update cursor based on hover position
    updateCursor(x, y);

    // Handle creation mode - update temp annotation preview
    if (isCreating && startPos && tempAnnotation) {
      if (tempAnnotation.type === "pen") {
        // For pen, add points as we move
        const currentPoints = tempAnnotation.position.points || [];
        const lastPoint = currentPoints[currentPoints.length - 1];
        
        // Only add point if moved at least 2 pixels (smooth but responsive)
        if (!lastPoint || Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2)) > 2) {
          const updatedTemp: Annotation = {
            ...tempAnnotation,
            position: {
              ...tempAnnotation.position,
              points: [...currentPoints, { x, y }]
            },
          };
          setTempAnnotation(updatedTemp);
        }
      } else {
        const updatedTemp: Annotation = {
          ...tempAnnotation,
          position:
            tempAnnotation.type === "circle"
              ? {
                  x: startPos.x,
                  y: startPos.y,
                  width: Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2)),
                }
              : { x: startPos.x, y: startPos.y, x2: x, y2: y },
        };
        setTempAnnotation(updatedTemp);
      }
      return;
    }

    // Only proceed with drag/resize if we have start position
    if (!dragStartPos || !initialAnnoState) return;

    const deltaX = x - dragStartPos.x;
    const deltaY = y - dragStartPos.y;

    if (isResizing && selectedAnnotation && resizeHandle) {
      const newAnnotations = annotations.map((anno) => {
        if (anno.id === selectedAnnotation) {
          switch (anno.type) {
            case "text":
              if (resizeHandle === "corner" && anno.content) {
                // Scale text based on distance from origin
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext("2d");
                if (ctx) {
                  const initialFontSize = initialAnnoState.fontSize || 20;
                  // CRITICAL: Measure with the INITIAL font size, not current
                  ctx.font = `${initialFontSize}px Arial`;
                  const initialWidth = ctx.measureText(anno.content).width;
                  const newWidth = Math.max(20, initialWidth + deltaX);
                  const scale = newWidth / initialWidth;
                  const newFontSize = Math.max(10, initialFontSize * scale);
                  
                  return {
                    ...anno,
                    fontSize: newFontSize,
                  };
                }
              }
              break;
            case "arrow":
            case "line":
              if (resizeHandle === "start") {
                return {
                  ...anno,
                  position: {
                    ...anno.position,
                    x: initialAnnoState.position.x + deltaX,
                    y: initialAnnoState.position.y + deltaY,
                  },
                };
              } else if (resizeHandle === "end") {
                return {
                  ...anno,
                  position: {
                    ...anno.position,
                    x2: (initialAnnoState.position.x2 || 0) + deltaX,
                    y2: (initialAnnoState.position.y2 || 0) + deltaY,
                  },
                };
              }
              break;
            case "circle":
              if (resizeHandle === "radius") {
                const newRadius = Math.sqrt(
                  Math.pow(x - anno.position.x, 2) + Math.pow(y - anno.position.y, 2)
                );
                return {
                  ...anno,
                  position: {
                    ...anno.position,
                    width: Math.max(10, newRadius),
                  },
                };
              }
              break;
          }
        }
        return anno;
      });
      setAnnotations(newAnnotations);
    } else if (isDragging && selectedAnnotation) {
      const newAnnotations = annotations.map((anno) => {
        if (anno.id === selectedAnnotation) {
          return {
            ...anno,
            position: {
              ...anno.position,
              x: initialAnnoState.position.x + deltaX,
              y: initialAnnoState.position.y + deltaY,
              x2: initialAnnoState.position.x2 !== undefined ? initialAnnoState.position.x2 + deltaX : undefined,
              y2: initialAnnoState.position.y2 !== undefined ? initialAnnoState.position.y2 + deltaY : undefined,
            },
          };
        }
        return anno;
      });
      setAnnotations(newAnnotations);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoordinates(e);

    if (isDragging || isResizing) {
      addToHistory(annotations);
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStartPos(null);
      setInitialAnnoState(null);
      return;
    }

    // Finalize creation - convert temp annotation to permanent
    if (isCreating && tempAnnotation && startPos) {
      let shouldCreate = false;
      
      if (tempAnnotation.type === "pen") {
        // For pen, check if we have enough points (meaningful stroke)
        const points = tempAnnotation.position.points || [];
        shouldCreate = points.length >= 2; // At least 2 points to create a line
      } else {
        // For other tools, check drag distance
        const dragDistance = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        shouldCreate = dragDistance > 5; // Minimum 5px drag to create
      }
      
      if (shouldCreate) {
        const finalAnnotation: Annotation = {
          ...tempAnnotation,
          id: `anno-${Date.now()}`, // Replace temp ID with permanent ID
        };
        const newAnnotations = [...annotations, finalAnnotation];
        setAnnotations(newAnnotations);
        addToHistory(newAnnotations);
      }
      
      // Clean up creation state
      setIsCreating(false);
      setTempAnnotation(null);
      setStartPos(null);
      setIsDrawing(false);
    }
  };

  const handleAddText = () => {
    if (textPosition && textInput) {
      const newAnnotation: Annotation = {
        id: `anno-${Date.now()}`,
        type: "text",
        content: textInput,
        color: selectedColor,
        strokeWidth: strokeWidth,
        fontSize: 20 + strokeWidth * 3,
        position: { x: textPosition.canvasX, y: textPosition.canvasY },
      };
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
      setTextInput("");
      setTextPosition(null);
    }
  };

  // Touch event handlers for mobile support
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Ignore multi-touch to keep state consistent
    if (e.touches.length > 1) return;
    
    e.preventDefault(); // Prevent scrolling while drawing
    const touch = e.touches[0];
    if (!touch) return; // Defensive check
    
    // Create a synthetic mouse event with touch coordinates
    const syntheticEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    
    handleCanvasMouseDown(syntheticEvent);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Ignore multi-touch to keep state consistent
    if (e.touches.length > 1) return;
    
    e.preventDefault(); // Prevent scrolling while drawing
    const touch = e.touches[0];
    if (!touch) return; // Defensive check
    
    // Create a synthetic mouse event with touch coordinates
    const syntheticEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    
    handleCanvasMouseMove(syntheticEvent);
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    e.preventDefault();
    const touch = e.changedTouches[0]; // Use changedTouches for touchend
    
    if (!touch) {
      // Fallback cleanup if no touch info available
      setIsDragging(false);
      setIsResizing(false);
      setIsCreating(false);
      setDragStartPos(null);
      setResizeHandle(null);
      setInitialAnnoState(null);
      setTempAnnotation(null);
      setStartPos(null);
      setIsDrawing(false);
      return;
    }
    
    // Create a synthetic mouse event with touch coordinates
    const syntheticEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    
    handleCanvasMouseUp(syntheticEvent);
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotation) {
      const newAnnotations = annotations.filter((a) => a.id !== selectedAnnotation);
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
    toast({
      title: "Annotations saved",
      description: "Photo annotations have been saved successfully",
    });
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "annotated-photo.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
    toast({
      title: "Downloaded",
      description: "Annotated photo has been downloaded",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compact Toolbar */}
      <div className="border-b p-2 bg-background">
        {/* Row 1: Drawing Tools */}
        <div className="flex items-center gap-1 mb-2">
          <Button
            variant={tool === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("text")}
            data-testid="button-tool-text"
            className="flex-1 text-xs"
            aria-label="Text tool"
          >
            <Type className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Text</span>
          </Button>
          <Button
            variant={tool === "arrow" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("arrow")}
            data-testid="button-tool-arrow"
            className="flex-1 text-xs"
            aria-label="Arrow tool"
          >
            <ArrowRight className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Arrow</span>
          </Button>
          <Button
            variant={tool === "line" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("line")}
            data-testid="button-tool-line"
            className="flex-1 text-xs"
            aria-label="Line tool"
          >
            <Minus className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Line</span>
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("circle")}
            data-testid="button-tool-circle"
            className="flex-1 text-xs"
            aria-label="Circle tool"
          >
            <Circle className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Circle</span>
          </Button>
          <Button
            variant={tool === "pen" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("pen")}
            data-testid="button-tool-pen"
            className="flex-1 text-xs"
            aria-label="Pen tool"
          >
            <Pen className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Pen</span>
          </Button>
        </div>

        {/* Row 2: Size, Color, and Actions */}
        <div className="flex items-center gap-1">
          {/* Stroke Size */}
          <ToggleGroup
            type="single"
            value={strokeWidth.toString()}
            onValueChange={(value) => value && setStrokeWidth(parseInt(value))}
            className="gap-1"
          >
            {strokeSizes.map((size) => (
              <ToggleGroupItem
                key={size.value}
                value={size.value.toString()}
                aria-label={`Size ${size.name}`}
                data-testid={`button-size-${size.name.toLowerCase()}`}
                className="h-7 px-2 text-xs"
              >
                {size.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {/* Color Picker */}
          <Select value={selectedColor} onValueChange={setSelectedColor}>
            <SelectTrigger className="h-7 w-[100px] text-xs" data-testid="select-color">
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: selectedColor }}
                />
                <span className="hidden sm:inline text-xs">
                  {colors.find((c) => c.value === selectedColor)?.name}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {colors.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border border-border"
                      style={{ backgroundColor: color.value }}
                    />
                    {color.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Actions */}
          <div className="flex gap-1 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex === 0}
              data-testid="button-undo"
              className="h-7 px-2"
              aria-label="Undo last annotation"
            >
              <Undo className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              data-testid="button-clear-all"
              className="h-7 px-2"
              aria-label="Clear all annotations"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              data-testid="button-download"
              className="h-7 px-2 hidden sm:flex"
              aria-label="Download annotated photo"
            >
              <Download className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave} 
              data-testid="button-save-annotations"
              className="h-7 px-3 text-xs"
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas - fills remaining space */}
      <div className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center p-2">
        <div className="relative max-w-full max-h-full flex items-center justify-center">
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
            className="rounded shadow-lg touch-none"
            data-testid="canvas-annotation"
          />
          
          {/* Inline Text Input - appears directly on canvas */}
          {textPosition && (
            <div
              style={{
                position: 'absolute',
                left: `${textPosition.screenX}px`,
                top: `${textPosition.screenY}px`,
                transform: 'translate(0, -50%)',
                zIndex: 10000,
                pointerEvents: 'auto',
              }}
              data-testid="text-input-wrapper"
            >
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type text..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddText();
                  } else if (e.key === "Escape") {
                    setTextPosition(null);
                    setTextInput("");
                  }
                }}
                onBlur={() => {
                  if (textInput.trim()) {
                    handleAddText();
                  } else {
                    setTextPosition(null);
                  }
                }}
                autoFocus
                data-testid="input-text-annotation"
                className="min-w-[200px] bg-background/90 backdrop-blur-sm rounded-lg border-2 border-primary shadow-lg text-sm"
                style={{
                  fontSize: `${Math.max(14, 16 + strokeWidth * 2)}px`,
                  color: selectedColor,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
