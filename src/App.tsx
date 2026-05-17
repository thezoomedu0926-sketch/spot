/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva';
import { io, Socket } from 'socket.io-client';
import useImage from 'use-image';
import { 
  Palette, 
  Eraser, 
  Trash2, 
  Users, 
  RefreshCw,
  Minus,
  Plus,
  Download,
  Undo2,
  Redo2
} from 'lucide-react';

interface Stroke {
  id: string;
  userId: string;
  points: number[];
  color: string;
  width: number;
}

export default function App() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [myId, setMyId] = useState<string>('');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState('#ff0000'); 
  const [lineWidth, setLineWidth] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [image] = useImage('/background.png');
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const socketRef = useRef<Socket | null>(null);
  const stageRef = useRef<any>(null);

  // Layout constants
  const SIDEBAR_WIDTH = 80;
  const NAV_HEIGHT = 64;
  const FOOTER_HEIGHT = 40;
  const PADDING = 64; 

  useEffect(() => {
    const socketUrl = window.location.origin;
    socketRef.current = io(socketUrl);

    socketRef.current.on('connect', () => {
      setMyId(socketRef.current?.id || '');
    });

    socketRef.current.on('init-state', (initialStrokes: Stroke[]) => {
      setStrokes(initialStrokes);
    });

    socketRef.current.on('draw', (newStroke: Stroke) => {
      setStrokes((prev) => [...prev, newStroke]);
    });

    socketRef.current.on('delete-stroke', (id: string) => {
      setStrokes((prev) => prev.filter(s => s.id !== id));
    });

    socketRef.current.on('clear', () => {
      setStrokes([]);
      setUndoStack([]);
      setRedoStack([]);
    });

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Calculate scaling to fit image in workspace
  const getStageDimensions = () => {
    if (!image) return { width: 1000, height: 700, scale: 1 };

    const isLargeScreen = dimensions.width >= 1024;
    const rightPanelWidth = isLargeScreen ? 256 : 0;
    
    const availableWidth = dimensions.width - SIDEBAR_WIDTH - rightPanelWidth - PADDING;
    const availableHeight = dimensions.height - NAV_HEIGHT - FOOTER_HEIGHT - PADDING;

    const scale = Math.min(
      availableWidth / image.width,
      availableHeight / image.height
    );

    return {
      width: image.width * scale,
      height: image.height * scale,
      scale: scale
    };
  };

  const stageData = getStageDimensions();

  const handleMouseDown = (e: any) => {
    if (!myId) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    const worldX = pos.x / stageData.scale;
    const worldY = pos.y / stageData.scale;

    setCurrentStroke({
      id: Math.random().toString(36).substring(2, 9),
      userId: myId,
      points: [worldX, worldY],
      color: isEraser ? '#ffffff' : color,
      width: lineWidth / stageData.scale,
    });
  };

  const handleMouseMove = (e: any) => {
    if (!currentStroke) return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const worldX = pos.x / stageData.scale;
    const worldY = pos.y / stageData.scale;

    const newPoints = [...currentStroke.points, worldX, worldY];
    setCurrentStroke({ ...currentStroke, points: newPoints });
  };

  const handleMouseUp = () => {
    if (currentStroke) {
      setStrokes((prev) => [...prev, currentStroke]);
      setUndoStack((prev) => [...prev, currentStroke.id]);
      setRedoStack([]);
      socketRef.current?.emit('draw', currentStroke);
      setCurrentStroke(null);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const lastId = undoStack[undoStack.length - 1];
    const strokeToUndo = strokes.find(s => s.id === lastId);

    if (strokeToUndo) {
      setRedoStack(prev => [...prev, strokeToUndo]);
      setUndoStack(prev => prev.slice(0, -1));
      socketRef.current?.emit('delete-stroke', lastId);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const strokeToRedo = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, strokeToRedo.id]);
    socketRef.current?.emit('draw', strokeToRedo);
  };

  const handleClear = () => {
    if (window.confirm('모든 낙서를 지우시겠습니까?')) {
      socketRef.current?.emit('clear');
    }
  };

  const handleExport = () => {
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = 'training-board.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group strokes by user
  const strokesByUser = strokes.reduce((acc, stroke) => {
    if (!acc[stroke.userId]) {
      acc[stroke.userId] = [];
    }
    acc[stroke.userId].push(stroke);
    return acc;
  }, {} as Record<string, Stroke[]>);

  const userIds = Object.keys(strokesByUser);

  // Predefined colors for corporate training
  const colors = ['#000000', '#ff0000', '#0000ff', '#00aa00', '#ffaa00', '#8800ff'];

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f0] overflow-hidden font-sans text-[#4a4a3a]">
      {/* Navigation Bar */}
      <nav className="h-16 px-6 flex items-center justify-between border-b border-[#e0e0d5] bg-white/50 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white font-serif italic text-2xl shadow-sm">
            C
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#4a4a3a]">
            협업 그림판 <span className="text-sm font-sans font-medium text-[#8a8a7a] ml-2 opacity-70">Design Thinking Workshop</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-white/60 rounded-xl border border-[#e0e0d5] p-1 gap-1">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8a8a7a] hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="실행 취소 (Undo)"
            >
              <Undo2 size={20} />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8a8a7a] hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="다시 실행 (Redo)"
            >
              <Redo2 size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#5A5A40]/10 text-[#5A5A40] px-3 py-1 rounded-full text-xs font-bold border border-[#5A5A40]/20">
            <Users size={14} />
            LIVE CONNECTED
          </div>
          <div className="w-px h-6 bg-[#e0e0d5]" />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 bg-white border border-[#e0e0d5] text-[#4a4a3a] rounded-full hover:bg-[#fdfdfb] transition-all shadow-sm font-medium text-sm active:scale-95"
          >
            <Download size={16} />
            Export Canvas
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-5 py-2 bg-[#5A5A40] text-white rounded-full hover:bg-[#4a4a35] transition-all shadow-md font-medium text-sm active:scale-95"
          >
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tools */}
        <aside className="w-20 border-r border-[#e0e0d5] flex flex-col items-center py-8 gap-8 bg-white/30">
          <div className="p-2.5 bg-white shadow-sm rounded-2xl border border-[#5A5A40]/10 flex flex-col gap-4">
            <button
              onClick={() => setIsEraser(false)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${!isEraser ? 'bg-[#5A5A40] text-white shadow-lg' : 'text-[#8a8a7a] hover:bg-slate-50'}`}
              title="브러시"
            >
              <Palette size={22} />
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isEraser ? 'bg-[#5A5A40] text-white shadow-lg' : 'text-[#8a8a7a] hover:bg-slate-50'}`}
              title="지우개"
            >
              <Eraser size={22} />
            </button>
          </div>

          <div className="flex flex-col gap-3 p-2 bg-white/60 rounded-full border border-[#e0e0d5]">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 active:scale-90 shadow-sm ${color === c && !isEraser ? 'ring-2 ring-[#5A5A40] ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 p-2 bg-white/60 rounded-2xl border border-[#e0e0d5]">
            <button onClick={() => setLineWidth(Math.min(20, lineWidth + 2))} className="text-[#8a8a7a] hover:text-[#5A5A40] p-1 transition-colors">
              <Plus size={16} />
            </button>
            <div className="text-[10px] font-bold text-[#5A5A40] font-mono tracking-tighter leading-none">{lineWidth}px</div>
            <button onClick={() => setLineWidth(Math.max(1, lineWidth - 2))} className="text-[#8a8a7a] hover:text-[#5A5A40] p-1 transition-colors">
              <Minus size={16} />
            </button>
          </div>
        </aside>

        {/* Drawing Canvas Section */}
        <section className="flex-1 bg-[#efefe9] p-8 overflow-hidden relative cursor-crosshair">
          <div className="w-full h-full bg-[#fdfdfb] rounded-[32px] shadow-2xl border border-white relative overflow-hidden flex justify-center items-center">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#5A5A40_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            
            <div className="relative shadow-inner bg-white/50 ring-1 ring-[#e0e0d5]/50">
              <Stage
                width={stageData.width}
                height={stageData.height}
                scaleX={stageData.scale}
                scaleY={stageData.scale}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                ref={stageRef}
              >
                {/* 1. Background Layer (Independent) */}
                <Layer>
                  {image && (
                    <KonvaImage
                      image={image}
                      width={image.width}
                      height={image.height}
                    />
                  )}
                </Layer>

                {/* 2. User Layers (Erasers only affect their own layer) */}
                {userIds.map(uid => (
                  <Layer key={uid}>
                    {strokesByUser[uid].map((stroke) => (
                      <Line
                        key={stroke.id}
                        points={stroke.points}
                        stroke={stroke.color}
                        strokeWidth={stroke.width}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation={
                          stroke.color === '#ffffff' ? 'destination-out' : 'source-over'
                        }
                      />
                    ))}
                    {/* Current user's active stroke drawing on their layer */}
                    {uid === myId && currentStroke && (
                      <Line
                        points={currentStroke.points}
                        stroke={currentStroke.color}
                        strokeWidth={currentStroke.width}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation={
                          currentStroke.color === '#ffffff' ? 'destination-out' : 'source-over'
                        }
                      />
                    )}
                  </Layer>
                ))}

                {/* Handle case where user hasn't drawn anything yet but is drawing now */}
                {!strokesByUser[myId] && myId && currentStroke && (
                  <Layer>
                    <Line
                      points={currentStroke.points}
                      stroke={currentStroke.color}
                      strokeWidth={currentStroke.width}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        currentStroke.color === '#ffffff' ? 'destination-out' : 'source-over'
                      }
                    />
                  </Layer>
                )}
              </Stage>
            </div>

            {/* Bottom Status Decoration */}
            <div className="absolute bottom-10 right-10 flex flex-col gap-2 pointer-events-none select-none">
              <div className="bg-[#FF7043] text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg animate-pulse">
                Instructor is active...
              </div>
              <div className="flex items-center gap-2 self-end">
                <div className="w-4 h-4 rounded-full bg-[#5A5A40] shadow-sm animate-bounce"></div>
                <span className="text-[10px] font-bold bg-white/80 text-[#4a4a3a] px-3 py-1 rounded-full shadow-sm border border-[#e0e0d5]">
                  Collaborative Workspace
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Info Panel */}
        <aside className="w-64 border-l border-[#e0e0d5] bg-white/30 p-6 flex flex-col gap-8 hidden lg:flex">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-[#8a8a7a]">Live Feed</h3>
            <div className="space-y-4">
              <div className="flex gap-3 items-start group">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 transition-transform group-hover:scale-150"></div>
                <p className="text-xs leading-relaxed text-[#4a4a3a]"><strong>강사</strong>님이 섹션을 강조하고 계십니다.</p>
              </div>
              <div className="flex gap-3 items-start group">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 transition-transform group-hover:scale-150"></div>
                <p className="text-xs leading-relaxed text-[#4a4a3a]">다른 참여자가 그림을 그리고 있습니다.</p>
              </div>
            </div>
          </div>

          <div className="mt-auto bg-[#5A5A40]/5 p-5 rounded-[24px] border border-[#5A5A40]/10 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase font-bold opacity-60 text-[#8a8a7a]">Session Active</span>
              <span className="font-serif text-xl font-bold text-[#5A5A40]">LIVE</span>
            </div>
            <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-[#5A5A40] w-[65%] rounded-full"></div>
            </div>
            <p className="text-[10px] mt-3 text-center text-[#8a8a7a] font-medium italic">Empowering Team Creativity</p>
          </div>
        </aside>
      </div>

      <footer className="h-10 bg-white/80 border-t border-[#e0e0d5] px-6 flex items-center justify-between text-[10px] font-medium text-[#8a8a7a] tracking-wide">
        <span>&copy; 2026 Collaborative Workshop Board</span>
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]/40"></div>
            User ID: {myId.substring(0, 5)}...
          </span>
          <span className="flex items-center gap-1.5 text-[#5A5A40] font-bold">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div> 
            Server Sync Active
          </span>
        </div>
      </footer>
    </div>
  );
}
