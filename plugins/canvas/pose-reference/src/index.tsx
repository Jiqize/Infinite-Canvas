import { definePlugin, readImageSize, useEffect, useRef, useState } from '@infinite-canvas/plugin-sdk';
import type { CanvasNodeContentProps, CanvasNodeData } from '@infinite-canvas/plugin-sdk';
import type { PointerEvent } from 'react';
import { createMannequinStage, FRAME_OPTIONS, POSE_OPTIONS } from './mannequin';
import type { Framing, PoseId } from './mannequin';

function imageSource(node: CanvasNodeData) {
    return node.type === 'image' && typeof node.metadata?.content === 'string' ? node.metadata.content : '';
}

function wrapYaw(value: number) {
    const angle = Math.round(value);
    return ((angle + 180) % 360 + 360) % 360 - 180;
}

function clampPitch(value: number) {
    return Math.max(-90, Math.min(90, Math.round(value)));
}

function cameraLabel(yaw: number, pitch: number) {
    const a = Math.abs(yaw);
    const side = a === 0 ? '正面' : a === 180 ? '背面' : (yaw > 0 ? '右' : '左') + (a === 90 ? '侧面' : a > 90 ? '后方' : '前方') + ' ' + a + '°';
    return side + ' · ' + (pitch === 0 ? '平视' : pitch > 0 ? '俯拍 ' + pitch + '°' : '仰拍 ' + Math.abs(pitch) + '°');
}

const imagePrompt = '图片1是需要保留的人物原图：以此图的人物身份、面容、发型、服装款式、颜色、面料细节、拍摄场景和画面风格为准。图片2只作为姿势参考：借用人物的身体朝向、站坐姿、手臂和腿部的位置与重心；不要复制图片2的人脸、发型、衣服、道具或背景。生成图片1中的同一个人，以图片2的姿势自然重新拍摄，保持合理的人体结构、衣服褶皱和光影。';

function PoseReferenceContent({ ctx }: CanvasNodeContentProps) {
    const inputs = ctx.getUpstream().filter((node) => imageSource(node));
    const person = inputs.find((node) => node.id === ctx.node.metadata?.posePersonId) || inputs[0];
    const guide = inputs.find((node) => node.id === ctx.node.metadata?.poseGuideId && node.id !== person?.id) || inputs.find((node) => node.id !== person?.id);
    const mode = ctx.node.metadata?.poseMode === 'mannequin' || ctx.node.metadata?.poseMode !== 'image' && !ctx.node.metadata?.poseGuideId ? 'mannequin' : 'image';
    const pose = POSE_OPTIONS.find((option) => option.id === ctx.node.metadata?.posePreset)?.id || 'pocket';
    const framing = FRAME_OPTIONS.find((option) => option.id === ctx.node.metadata?.poseFraming)?.id || 'full';
    const yaw = wrapYaw(Number(ctx.node.metadata?.poseYaw) || 0);
    const pitch = clampPitch(Number(ctx.node.metadata?.posePitch) || 0);
    const [running, setRunning] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [stageReady, setStageReady] = useState(false);
    const [stageError, setStageError] = useState('');
    const [message, setMessage] = useState('');
    const abortRef = useRef<AbortController | null>(null);
    const mountRef = useRef<HTMLDivElement | null>(null);
    const stageRef = useRef<ReturnType<typeof createMannequinStage> | null>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
    const theme = ctx.theme;

    useEffect(() => {
        if (mode !== 'mannequin') {
            setStageReady(false);
            return;
        }
        const mount = mountRef.current;
        if (!mount) return;
        let stage: ReturnType<typeof createMannequinStage> | null = null;
        let observer: ResizeObserver | null = null;
        try {
            stage = createMannequinStage({ pose, yaw, pitch, framing });
            mount.appendChild(stage.canvas);
            stageRef.current = stage;
            observer = new ResizeObserver(() => {
                if (stage) stage.resize(mount.clientWidth, mount.clientHeight);
            });
            observer.observe(mount);
            stage.resize(mount.clientWidth, mount.clientHeight);
            setStageReady(true);
            setStageError('');
        } catch (error) {
            setStageError(error instanceof Error ? error.message : String(error));
        }
        return () => {
            observer?.disconnect();
            stageRef.current = null;
            stage?.canvas.remove();
            stage?.dispose();
        };
    }, [mode]);

    useEffect(() => {
        stageRef.current?.update({ pose, yaw, pitch, framing });
    }, [pose, yaw, pitch, framing]);

    const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
    };

    const generate = async () => {
        if (!person || running || mode === 'image' && !guide || mode === 'mannequin' && !stageReady) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setRunning(true);
        setMessage('生成中…');
        try {
            const poseName = POSE_OPTIONS.find((option) => option.id === pose)?.label || '站姿';
            const frameName = FRAME_OPTIONS.find((option) => option.id === framing)?.label || '全身';
            const reference = mode === 'mannequin' ? stageRef.current?.capture() : imageSource(guide!);
            if (!reference) throw new Error('白膜画面尚未就绪');
            const prompt = mode === 'mannequin'
                ? '图片1是人物原图，必须保留同一个人的面容、发型、身形、服装、鞋子、颜色、材质及原有背景。图片2是无服装的3D白膜摄影示意，只用于确定身体姿势、人物朝向、相机位置和画面取景；不要把白膜材质、无脸头部、地台或任何示意物体画进结果。按图片2的' + poseName + '姿势、' + cameraLabel(yaw, pitch) + '机位和' + frameName + '景别重新拍摄图片1中的人物。若景别裁切身体，以图片2的构图为准；保持合理的手脚、衣服褶皱和光影。'
                : imagePrompt;
            const result = await ctx.ai.generateImage(prompt, { references: [imageSource(person), reference], count: 1, signal: controller.signal });
            const image = result.images[0];
            if (!image) throw new Error('模型没有返回图片');
            const size = await readImageSize(image);
            if (controller.signal.aborted) {
                setMessage('已取消');
                return;
            }
            const id = 'pose-reference-' + ctx.node.id + '-' + Date.now().toString(36);
            const previous = ctx.getDownstream().filter((node) => node.type === 'image' && node.id.startsWith('pose-reference-' + ctx.node.id + '-'));
            const y = previous.length ? Math.max(...previous.map((node) => node.position.y + node.height)) + 24 : ctx.node.position.y;
            const width = 240;
            ctx.applyOps([
                {
                    type: 'add_node', id, nodeType: 'image', title: mode === 'mannequin' ? poseName + ' · ' + cameraLabel(yaw, pitch) + ' · ' + frameName : '姿势参考结果',
                    position: { x: ctx.node.position.x + ctx.node.width + 80, y },
                    width, height: Math.round((width * size.height) / size.width),
                    metadata: {
                        content: image, prompt, status: 'success', naturalWidth: size.width, naturalHeight: size.height,
                        mimeType: image.match(/^data:([^;,]+)/)?.[1] || 'image/png',
                        poseMode: mode, posePreset: pose, poseYaw: yaw, posePitch: pitch, poseFraming: framing,
                        posePersonNodeId: person.id, ...(mode === 'image' ? { poseGuideNodeId: guide?.id } : {}),
                    },
                },
                { type: 'connect_nodes', fromNodeId: ctx.node.id, toNodeId: id },
                { type: 'select_nodes', ids: [id] },
            ]);
            setMessage('已生成 1 张姿势图片');
        } catch (error) {
            setMessage(controller.signal.aborted ? '已取消' : '生成失败：' + (error instanceof Error ? error.message : String(error)));
        } finally {
            abortRef.current = null;
            setRunning(false);
        }
    };

    const imageCard = (title: string, selected: CanvasNodeData | undefined, key: 'posePersonId' | 'poseGuideId') => (
        <div style={{ minWidth: 0, padding: 8, border: '1px solid ' + theme.node.stroke, borderRadius: 10, background: theme.node.panel }}>
            <div style={{ marginBottom: 6, color: theme.node.text, fontSize: 12, fontWeight: 600 }}>{title}</div>
            <div style={{ position: 'relative', height: 138, borderRadius: 6, background: theme.node.fill, overflow: 'hidden' }}>
                {selected ? <img src={imageSource(selected)} alt={title} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ display: 'grid', placeItems: 'center', height: '100%', color: theme.node.muted, fontSize: 11 }}>连接图片节点</span>}
            </div>
            <select aria-label={title} value={selected?.id || ''} onChange={(event) => ctx.updateMetadata({ [key]: event.target.value })} style={{ width: '100%', marginTop: 7, padding: '4px 6px', border: '1px solid ' + theme.node.stroke, borderRadius: 6, background: theme.node.panel, color: theme.node.text, fontSize: 11 }}>
                {!selected ? <option value="">请选择图片</option> : null}
                {inputs.filter((node) => key === 'posePersonId' || node.id !== person?.id).map((node) => <option key={node.id} value={node.id}>{node.title || '未命名图片'}</option>)}
            </select>
        </div>
    );
    const selectStyle = { width: '100%', marginTop: 4, padding: '5px 6px', border: '1px solid ' + theme.node.stroke, borderRadius: 6, background: theme.node.panel, color: theme.node.text, fontSize: 12 };
    const labelStyle = { color: theme.node.muted, fontSize: 11 };

    return (
        <div data-canvas-no-zoom onMouseDown={(event) => {
            if (event.target instanceof Element && event.target.closest('[data-pose-orbit], select, button, input')) event.stopPropagation();
        }} onWheel={(event) => event.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', height: '100%', padding: 12, boxSizing: 'border-box', overflow: 'auto', color: theme.node.text }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 12 }}>姿势摄影台</strong>
                <span style={{ fontSize: 10, color: theme.node.muted }}>{mode === 'mannequin' ? '3D 白膜' : '图片参考'}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid ' + theme.node.stroke }}>
                {(['mannequin', 'image'] as const).map((item) => (
                    <button key={item} type="button" onClick={() => ctx.updateMetadata({ poseMode: item })} style={{ padding: '4px 1px 7px', border: 0, borderBottom: mode === item ? '2px solid ' + theme.node.activeStroke : '2px solid transparent', background: 'transparent', color: mode === item ? theme.node.text : theme.node.muted, fontSize: 11, cursor: 'pointer' }}>{item === 'mannequin' ? '白膜工作台' : '图片参考'}</button>
                ))}
            </div>
            {mode === 'mannequin' ? (
                <>
                    <div data-pose-orbit role="group" tabIndex={0} aria-label={'白膜机位：' + cameraLabel(yaw, pitch) + '。拖动或使用方向键调整'} onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.stopPropagation();
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch };
                        setDragging(true);
                    }} onPointerMove={(event) => {
                        const start = dragRef.current;
                        if (!start || start.pointerId !== event.pointerId) return;
                        const speed = 0.65 / Math.max(ctx.scale, 0.1);
                        ctx.updateMetadata({
                            poseYaw: wrapYaw(start.yaw + (event.clientX - start.x) * speed),
                            posePitch: clampPitch(start.pitch - (event.clientY - start.y) * speed),
                        });
                    }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onKeyDown={(event) => {
                        const step = event.shiftKey ? 10 : 5;
                        const patch = event.key === 'ArrowLeft' ? { poseYaw: wrapYaw(yaw - step) }
                            : event.key === 'ArrowRight' ? { poseYaw: wrapYaw(yaw + step) }
                                : event.key === 'ArrowUp' ? { posePitch: clampPitch(pitch + step) }
                                    : event.key === 'ArrowDown' ? { posePitch: clampPitch(pitch - step) } : null;
                        if (patch) {
                            event.preventDefault();
                            event.stopPropagation();
                            ctx.updateMetadata(patch);
                        }
                    }} style={{ position: 'relative', alignSelf: 'center', width: 216, aspectRatio: '3 / 4', border: '1px solid ' + theme.node.stroke, borderRadius: 10, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', outlineColor: theme.node.activeStroke, flexShrink: 0 }}>
                        <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                        {!stageReady ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: theme.node.muted, fontSize: 11, textAlign: 'center', padding: 12 }}>{stageError ? '3D 预览不可用：' + stageError : '载入白膜…'}</div> : null}
                        <span style={{ position: 'absolute', top: 7, left: 8, padding: '3px 5px', borderRadius: 5, background: 'rgba(255,255,255,.82)', color: '#383b42', fontSize: 10, pointerEvents: 'none' }}>{cameraLabel(yaw, pitch)}</span>
                        <span style={{ position: 'absolute', bottom: 7, left: 8, color: '#555a63', fontSize: 10, pointerEvents: 'none' }}>拖动调整机位</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={labelStyle}>姿势
                            <select aria-label="白膜姿势" value={pose} onChange={(event) => ctx.updateMetadata({ posePreset: event.target.value as PoseId })} style={selectStyle}>
                                {POSE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                        </label>
                        <label style={labelStyle}>景别
                            <select aria-label="景别" value={framing} onChange={(event) => ctx.updateMetadata({ poseFraming: event.target.value as Framing })} style={selectStyle}>
                                {FRAME_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                        </label>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: theme.node.muted }}>
                        <span>机位 {yaw}° / {pitch}°</span>
                        <button type="button" onClick={() => ctx.updateMetadata({ poseYaw: 0, posePitch: 0 })} style={{ padding: 2, border: 0, background: 'transparent', color: theme.node.text, cursor: 'pointer', fontSize: 11 }}>回正</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {person ? <img src={imageSource(person)} alt="人物原图" draggable={false} style={{ width: 34, height: 42, objectFit: 'contain', borderRadius: 4, background: theme.node.panel }} /> : null}
                        <label style={{ ...labelStyle, flex: 1, minWidth: 0 }}>人物原图
                            <select aria-label="人物原图" value={person?.id || ''} onChange={(event) => ctx.updateMetadata({ posePersonId: event.target.value })} style={selectStyle}>
                                {!person ? <option value="">连接图片节点</option> : null}
                                {inputs.map((node) => <option key={node.id} value={node.id}>{node.title || '未命名图片'}</option>)}
                            </select>
                        </label>
                    </div>
                </>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                        {imageCard('人物原图', person, 'posePersonId')}
                        {imageCard('姿势参考', guide, 'poseGuideId')}
                    </div>
                    <div style={labelStyle}>保留人物与服装，只借用右图的身体姿势。</div>
                </>
            )}
            <button type="button" disabled={!running && (!person || mode === 'image' && !guide || mode === 'mannequin' && !stageReady)} onClick={running ? () => abortRef.current?.abort() : generate} style={{ alignSelf: 'flex-start', padding: '5px 0', border: 0, background: 'transparent', color: theme.node.text, cursor: 'pointer', opacity: person && (mode === 'image' ? guide : stageReady) || running ? 1 : 0.45, fontSize: 12 }}>{running ? '取消' : '生成这个姿势'}</button>
            {message ? <div style={{ ...labelStyle, overflowWrap: 'anywhere' }}>{message}</div> : null}
        </div>
    );
}

export default definePlugin({
    id: 'pose-reference',
    name: '姿势参考节点',
    version: '1.1.0',
    description: '3D 白膜选姿势、机位与景别，或从图片借用姿势',
    nodes: [{
        type: 'pose-reference:node', title: '姿势参考', icon: '🕺', description: '白膜工作台或图片参考，生成同一人物的新姿势',
        defaultSize: { width: 390, height: 540 }, defaultMetadata: { poseMode: 'mannequin', posePreset: 'pocket', poseYaw: 0, posePitch: 0, poseFraming: 'full' },
        minimapColor: '#7b8cd0', hidePanel: true, Content: PoseReferenceContent,
    }],
});
