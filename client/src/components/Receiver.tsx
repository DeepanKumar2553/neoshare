import { useSocket } from "@/hooks/useSocket";
import { showError } from "@/hooks/useToast";
import { revokeReceiverAccess } from "@/store/accessSlice";
import { useAppDispatch } from "@/store/hooks";
import { triggerReconnect } from "@/store/socketSlice";
import { Button } from "@/ui/button";
import { Frame } from "@/ui/frame";
import { useEffect, useRef, useState } from "react";
import { FiDownload, FiFile, FiWifi } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

export default function Receiver() {
    const dispatch = useAppDispatch();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const [isRTCConnected, setIsRTCConnected] = useState(false);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<RTCDataChannel | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingIceCandidates = useRef<any[]>([]);
    const isLocalDescriptionSet = useRef(false);
    const [showDownloadButton, setShowDownloadButton] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [receivedFiles, setReceivedFiles] = useState<any[]>([]);
    const [receiveProgress, setReceiveProgress] = useState(0);
    const [receiveStatus, setReceiveStatus] = useState("Waiting for files...");
    const [uiState, setUiState] = useState(true);

    const totalFilesExpected = useRef(0);
    const filesCompleted = useRef(0);

    const [downloadSpeed, setDownloadSpeed] = useState(0);
    const [downloadSpeedUnit, setDownloadSpeedUnit] = useState("KB/s");
    const bytesReceivedRef = useRef(0);

    const listRef = useRef<HTMLDivElement | null>(null);

    const roomCode = useSelector((state: RootState) => state.room.roomCode);

    const relayWsRef = useRef<WebSocket | null>(null);

    const fileDataRef = useRef<{
        [fileId: string]: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            meta: any;
            chunks: ArrayBuffer[];
            receivedSize: number
        }
    }>({});

    const roomCodeRef = useRef<string>("");

    useEffect(() => {
        roomCodeRef.current = roomCode;
    }, [roomCode]);

    useEffect(() => {
        console.log("Receiver page mounted");

        const handleRoomDestroyed = (data: { title: string, description?: string }) => {
            navigate('/enter', { replace: true });
            showError(data.title, data.description)
        };

        if (socket) {
            socket.on("room-destroyed", handleRoomDestroyed);
        }

        return () => {
            console.log("Receiver page unmounted");

            if (socket && socket.connected) {
                socket.emit("leave-room");
            }

            if (socket) {
                socket.off("room-destroyed", handleRoomDestroyed);
            }

            if (channelRef.current) {
                channelRef.current.close();
                channelRef.current = null;
            }
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
            if (relayWsRef.current) {
                relayWsRef.current.close();
                relayWsRef.current = null;
            }

            dispatch(triggerReconnect())
            dispatch(revokeReceiverAccess());
        }
    }, [dispatch, socket, navigate]);

    const sendData = (data: string) => {
        if (relayWsRef.current && relayWsRef.current.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(data);
            return true;
        }
        if (channelRef.current && channelRef.current.readyState === "open") {
            channelRef.current.send(data);
            return true;
        }
        return false;
    };

    function handleAccept() {
        const message = JSON.stringify({ type: "PERMISSION_GRANTED" });

        if (sendData(message)) {
            console.log("Accepted file transfer, sending PERMISSION_GRANTED");
            setShowDownloadButton(false);
            setReceiveStatus("Waiting for files...");
        } else {
            console.error("Could not send acceptance. No connection available.");
            showError("Connection Error", "Could not accept the transfer.");
        }
    }

    const initializeFileTransfer = () => {
        fileDataRef.current = {};
        filesCompleted.current = 0;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleFileMetadata = (fileId: string, meta: any) => {
        setReceiveStatus(`Receiving ${meta.name}...`);
        setReceiveProgress(0);
        setUiState(false);

        fileDataRef.current[fileId] = {
            meta,
            chunks: [],
            receivedSize: 0
        };
    };

    const handleFileChunk = (fileId: string, chunk: ArrayBuffer) => {
        if (!fileDataRef.current[fileId]) {
            console.error("No file metadata for chunk", fileId);
            return;
        }

        fileDataRef.current[fileId].chunks.push(chunk);
        fileDataRef.current[fileId].receivedSize += chunk.byteLength;

        bytesReceivedRef.current += chunk.byteLength;

        const progress = Math.round(
            (fileDataRef.current[fileId].receivedSize / fileDataRef.current[fileId].meta.size) * 100
        );
        setReceiveProgress(progress);
    };

    const cleanupPartialFiles = () => {
        Object.keys(fileDataRef.current).forEach(fileId => {
            console.warn(`Cleaning up partial file: ${fileDataRef.current[fileId].meta.name}`);
            delete fileDataRef.current[fileId];
        });
    };

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    const cleanupAfterTransfer = () => {
        fileDataRef.current = {};

        filesCompleted.current = 0;

        setReceiveProgress(0);
        setReceiveStatus("Transfer complete. Ready for new transfer.");

        pendingIceCandidates.current = [];

        isLocalDescriptionSet.current = false;

        setReceivedFiles([]);

        console.log("Cleanup completed - ready for new transfer");
    };

    useEffect(() => {
        if (!socket) return;

        const finalizeFile = async (fileId: string, success: boolean) => {
            if (!fileDataRef.current[fileId]) return;

            const { meta, chunks, receivedSize } = fileDataRef.current[fileId];

            if (success && receivedSize === meta.size) {
                setReceiveStatus(`Received ${meta.name}`);

                const blob = new Blob(chunks, { type: meta.type });
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = meta.name;
                a.style.display = "none";
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    filesCompleted.current += 1;
                    if (filesCompleted.current >= totalFilesExpected.current) {
                        console.log("All files transferred and saved completely!");
                        cleanupAfterTransfer();
                        setUiState(true);
                    }
                }, 1000);

                setReceivedFiles(prev => [...prev, { name: meta.name, size: meta.size, date: new Date() }]);
            } else {
                console.warn(`File "${meta.name}" incomplete. Received ${receivedSize} of ${meta.size} bytes`);
                setReceiveStatus(`Incomplete: ${meta.name}`);

                filesCompleted.current += 1;
                if (filesCompleted.current >= totalFilesExpected.current) {
                    console.log("All files processed (some may be incomplete)!");
                    cleanupAfterTransfer();
                    setUiState(true);
                }
            }

            delete fileDataRef.current[fileId];
            setReceiveProgress(0);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleDataMessage = async (e: MessageEvent<any>) => {
            try {
                if (typeof e.data === "string") {
                    const msg = JSON.parse(e.data);

                    if (msg.type === "REQUEST_PERMISSION") {
                        console.log(`Sender requested to send ${msg.fileCount || 0} files`);
                        totalFilesExpected.current = msg.fileCount || 0;
                        if (msg.fileCount > 0) {
                            setShowDownloadButton(true);
                            setReceiveStatus(`Incoming request for ${msg.fileCount} files`);
                        } else {
                            console.log("No files to receive");
                            setReceiveStatus("No files to receive");
                        }
                    }
                    else if (msg.type === "FILE_META") {
                        setUiState(false);
                        handleFileMetadata(msg.fileId, {
                            name: msg.name,
                            size: msg.size,
                            type: msg.type
                        });
                    }
                    else if (msg.type === "FILE_END") {
                        await finalizeFile(msg.fileId, msg.success);
                    }
                    return;
                }

                if (e.data instanceof ArrayBuffer) {
                    const fileIds = Object.keys(fileDataRef.current);
                    if (fileIds.length > 0) {
                        const fileId = fileIds[fileIds.length - 1];
                        handleFileChunk(fileId, e.data);
                    } else {
                        console.error("Received chunk but no active file transfer");
                    }
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
        }

        const switchToRelay = () => {
            if (relayWsRef.current?.readyState === WebSocket.OPEN) {
                console.log("Already connected to relay");
                return;
            }

            if (!roomCodeRef.current) {
                console.error("No room code available");
                return;
            }

            console.log("Switching to relay server");
            console.log("Room code:", roomCodeRef.current);

            if (pcRef.current) {
                console.log("Closing WebRTC connection");
                pcRef.current.close();
                pcRef.current = null;
            }
            if (channelRef.current) {
                channelRef.current.close();
                channelRef.current = null;
            }

            const ws = new WebSocket(`https://v84mq4h9-8080.inc1.devtunnels.ms/relay?room=${roomCodeRef.current}&role=receiver`);

            ws.binaryType = "arraybuffer";

            ws.onopen = () => {
                console.log("Connected to relay server");
                setIsRTCConnected(true);
            };

            ws.onmessage = (event) => {
                handleDataMessage(event);
            };

            ws.onerror = (error) => {
                console.error("Relay error:", error);
            };

            ws.onclose = () => {
                console.log("Relay closed");
                setIsRTCConnected(false);
            };

            relayWsRef.current = ws;
        };

        async function setupWebRTC() {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" },
                    { urls: "stun:stun3.l.google.com:19302" },
                    { urls: "stun:stun4.l.google.com:19302" }
                ]
            });
            pcRef.current = pc;

            pc.ondatachannel = (event) => {
                const channel = event.channel;
                channelRef.current = channel;
                initializeFileTransfer();

                channel.onopen = () => {
                    console.log("DataChannel open - ready to receive files");
                    setIsRTCConnected(true);
                };

                channel.onmessage = async (e) => {
                    handleDataMessage(e);
                };

                channel.onclose = () => {
                    console.log("DataChannel closed");
                    setIsRTCConnected(false);
                    cleanupPartialFiles();
                    setReceiveStatus("Connection closed");
                };
            };

            pc.oniceconnectionstatechange = () => {
                console.log("P2P State:", pc.iceConnectionState);

                if (pc.iceConnectionState === 'failed') {
                    console.log("P2P failed - switching to relay");
                    switchToRelay();
                }

                if (pc.iceConnectionState === 'disconnected') {
                    console.log("P2P disconnected - switching to relay");
                    switchToRelay();
                }
            };

            // const timeout = setTimeout(() => {
            //     if (pc.iceConnectionState !== 'connected') {
            //         console.log("P2P timeout - switching to relay");
            //         switchToRelay();
            //     }
            // }, 10000);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    if (isLocalDescriptionSet.current && socket) {
                        console.log("Sending ICE candidate to sender");
                        socket.emit("signal", {
                            type: "ice",
                            candidate: event.candidate
                        });
                    } else {
                        console.log("Queuing ICE candidate (local description not set)");
                        pendingIceCandidates.current.push(event.candidate);
                    }
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const offerHandler = async (message: any) => {
                if (!socket) return;

                if (message.type === "offer") {
                    console.log("Received offer from sender");

                    await pc.setRemoteDescription(
                        new RTCSessionDescription({
                            type: "offer",
                            sdp: message.sdp
                        })
                    );

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    socket.emit("signal", {
                        type: "answer",
                        sdp: answer.sdp
                    });
                    console.log("Answer SDP sent to sender");

                    isLocalDescriptionSet.current = true;

                    while (pendingIceCandidates.current.length > 0) {
                        const candidate = pendingIceCandidates.current.shift();
                        if (socket) {
                            console.log("Sending queued ICE candidate to sender");
                            socket.emit("signal", {
                                type: "ice",
                                candidate
                            });
                        }
                    }

                    socket.off("signal", offerHandler);
                }
            };

            if (!socket) return;

            socket.on("signal", offerHandler);

            socket.on("signal", async (message) => {
                if (message.type === "ice") {
                    console.log("Received ICE candidate from sender");
                    try {
                        await pc.addIceCandidate(
                            new RTCIceCandidate(message.candidate)
                        );
                    } catch (error) {
                        console.error("Error adding ICE candidate:", error);
                    }
                }
            });
        }

        setupWebRTC();

        return () => {
            if (channelRef.current) channelRef.current.close();
            if (pcRef.current) pcRef.current.close();
            setIsRTCConnected(false);
            cleanupPartialFiles();
        };
    }, [socket]);

    useEffect(() => {
        let touchStartY: number | null = null;
        let startScrollTop: number | null = null;

        const isPointOverList = (x: number, y: number) => {
            const el = listRef.current;
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        };

        const wheelHandler = (e: WheelEvent) => {
            const el = listRef.current;
            if (!el) return;

            if (isPointOverList(e.clientX, e.clientY)) {
                e.preventDefault();
                el.scrollTop += e.deltaY;
            }
        };

        const touchStart = (e: TouchEvent) => {
            const el = listRef.current;
            if (!el) return;
            const t = e.touches[0];
            if (!t) return;
            if (isPointOverList(t.clientX, t.clientY)) {
                touchStartY = t.clientY;
                startScrollTop = el.scrollTop;
            } else {
                touchStartY = null;
                startScrollTop = null;
            }
        };

        const touchMove = (e: TouchEvent) => {
            const el = listRef.current;
            if (!el || touchStartY === null || startScrollTop === null) return;
            const t = e.touches[0];
            if (!t) return;

            e.preventDefault();
            const dy = touchStartY - t.clientY;
            el.scrollTop = Math.max(0, startScrollTop + dy);
        };

        window.addEventListener("wheel", wheelHandler, { capture: true, passive: false });
        window.addEventListener("touchstart", touchStart, { capture: true, passive: true });
        window.addEventListener("touchmove", touchMove, { capture: true, passive: false });

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.removeEventListener("wheel", wheelHandler, { capture: true } as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.removeEventListener("touchstart", touchStart as any, { capture: true } as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.removeEventListener("touchmove", touchMove as any, { capture: true } as any);
        };
    }, []);


    // Speed calculation effect
    useEffect(() => {
        let lastBytes = 0;
        let lastTime = Date.now();

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000; // seconds
            const delta = bytesReceivedRef.current - lastBytes;

            if (elapsed > 0 && delta > 0) {
                const bytesPerSecond = delta / elapsed;

                let speed = 0;
                let unit = "B/s";

                if (bytesPerSecond >= 1024 * 1024) {
                    speed = bytesPerSecond / (1024 * 1024);
                    unit = "MB/s";
                } else if (bytesPerSecond >= 1024) {
                    speed = bytesPerSecond / 1024;
                    unit = "KB/s";
                } else {
                    speed = bytesPerSecond;
                }

                setDownloadSpeed(parseFloat(speed.toFixed(2)));
                setDownloadSpeedUnit(unit);
            }

            lastBytes = bytesReceivedRef.current;
            lastTime = now;
        }, 500);

        return () => clearInterval(interval);
    }, []);


    return (
        <div className="receiver-container">
            <div
                className={twMerge([
                    "relative size-100 flex items-center justify-center",
                    "[--color-frame-1-stroke:var(--color-primary)]/50",
                    "[--color-frame-1-fill:var(--color-primary)]/20",
                    "[--color-frame-2-stroke:var(--color-accent)]",
                    "[--color-frame-2-fill:var(--color-accent)]/20",
                    "[--color-frame-3-stroke:var(--color-accent)]",
                    "[--color-frame-3-fill:var(--color-accent)]/20",
                    "[--color-frame-4-stroke:var(--color-accent)]",
                    "[--color-frame-4-fill:var(--color-accent)]/20",
                    "[--color-frame-5-stroke:var(--color-primary)]/23",
                    "[--color-frame-5-fill:transparent]",
                    "frame-container"
                ])}
            >
                <Frame
                    className="drop-shadow-2xl drop-shadow-primary/50"
                    paths={JSON.parse(
                        '[{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-1-stroke)","fill":"var(--color-frame-1-fill)"},"path":[["M","37","12"],["L","0% + 59","12"],["L","0% + 85","0% + 33"],["L","79","0% + 12"],["L","50% - 3","12"],["L","50% + 16","30"],["L","100% - 35","30"],["L","100% - 16","47"],["L","100% - 16","100% - 47.05882352941177%"],["L","100% - 8","100% - 44.85294117647059%"],["L","100% - 9","100% - 16.666666666666668%"],["L","100% - 17","100% - 14.705882352941176%"],["L","100% - 17","100% - 30"],["L","100% - 34","100% - 12"],["L","50% + 13","100% - 12"],["L","50% + 15","100% - 26"],["L","50% - 11","100% - 12"],["L","37","100% - 12"],["L","19","100% - 30"],["L","19","0% + 50.490196078431374%"],["L","10","0% + 48.529411764705884%"],["L","10","0% + 20.098039215686274%"],["L","0% + 19.000000000000004","0% + 18.38235294117647%"],["L","19","29"],["L","37","12"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-2-stroke)","fill":"var(--color-frame-2-fill)"},"path":[["M","50% + 10","15"],["L","50% + 19","15"],["L","50% + 24","0% + 20"],["L","50% + 16","0% + 20"],["L","50% + 10","15"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-3-stroke)","fill":"var(--color-frame-3-fill)"},"path":[["M","50% + 25","15"],["L","50% + 34","15"],["L","50% + 40","0% + 21"],["L","50% + 31","0% + 21"],["L","50% + 25","15"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-4-stroke)","fill":"var(--color-frame-4-fill)"},"path":[["M","50% + 40","15"],["L","50% + 52","15"],["L","50% + 61","0% + 23"],["L","50% + 49","0% + 23"],["L","50% + 40","15"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-5-stroke)","fill":"var(--color-frame-5-fill)"},"path":[["M","36","3"],["L","0% + 58","0"],["L","0% + 84","0% + 40"],["L","81","0% + 0"],["L","50% - 1","4"],["L","50% + 5","6"],["L","50% + 54","7"],["L","50% + 74","23"],["L","100% - 32","21"],["L","100% - 8","42"],["L","100% - 9","100% - 52.450980392156865%"],["L","100% + 0","100% - 50.245098039215684%"],["L","100% + 0","100% - 15.196078431372548%"],["L","100% - 7","100% - 13.480392156862745%"],["L","100% - 7","100% - 27"],["L","100% - 29","100% - 3"],["L","50% + 14","100% + 0"],["L","50% + 21","100% - 31"],["L","50% - 13","100% + 0"],["L","37","100% - 4"],["L","11","100% - 28"],["L","10","0% + 55.3921568627451%"],["L","0","0% + 52.94117658823523%"],["L","1","0% + 18.627450980392158%"],["L","11","0% + 16.666666666666668%"],["L","11","25"],["L","36","3"]]}]'
                    )}
                />
                <div className="min-h-screen flex flex-col items-center justify-center p-4">
                    {/* Connection Status Indicator */}
                    {uiState && (showDownloadButton ? (
                        <div>
                            <div className="text-center text-xs text-gray-400">
                                <Button
                                    variant="default"
                                    className="m-10"
                                    onClick={handleAccept}
                                >
                                    <FiDownload className="mr-2" />
                                    Download
                                </Button>
                                <p>Secure connection established</p>
                                <p className="mt-1">Data transfer protocol: No Encrypted</p>
                                {/* <p className="mt-1">Peers must match categories</p> */}
                            </div>
                        </div>
                    ) : (
                        !isRTCConnected ? (
                            <>
                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2 bg-yellow-500/20 border border-yellow-500 animate-pulse">
                                        <FiWifi className="text-3xl text-yellow-500" />
                                    </div>
                                    <p className="text-yellow-500 font-medium">Awaiting Secure Connection....</p>
                                </div>
                                <div className="text-center text-xs text-gray-400">
                                    <p>Awaiting connection established</p>
                                    <p className="mt-1">Data transfer protocol: No Encrypted</p>
                                    {/* <p className="mt-1">Peers must match categories</p> */}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2 bg-green-500/20 border border-green-500 animate-pulse">
                                        <FiWifi className="text-3xl text-green-500" />
                                    </div>
                                    <p className="text-green-500 font-medium">Connected To Receive Files....</p>
                                </div>
                                <div className="text-center text-xs text-gray-400">
                                    <p>Secure connection established</p>
                                    <p className="mt-1">Data transfer protocol: No Encrypted</p>
                                    {/* <p className="mt-1">Peers must match categories</p> */}
                                </div>
                            </>
                        )
                    ))}

                    {/* Receive Status */}
                    {!uiState && (
                        <div className="w-full max-w-[280px] rounded-xl p-3 bg-gray-900/30 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-sm font-semibold text-white">RECEIVE STATUS</h2>
                                <span className="text-accent font-mono text-xs">
                                    {receivedFiles.length}/{totalFilesExpected.current}
                                </span>
                            </div>

                            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                                <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${receiveProgress}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs text-gray-300 truncate flex-1 mr-2">
                                    {receiveStatus}
                                </p>
                                <span className="text-xs text-green-500 whitespace-nowrap">
                                    {downloadSpeed} {downloadSpeedUnit}
                                </span>
                            </div>

                            <div className="text-right text-xs text-gray-400">
                                <span className="text-green-500">{receiveProgress}%</span> Complete
                            </div>

                            {/* Received files list */}
                            {receivedFiles.length > 0 && (
                                <div className="border-t border-gray-700 pt-3 mt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h2 className="text-sm font-semibold text-white">RECEIVED FILES</h2>
                                        <span className="text-accent font-mono text-xs">
                                            {receivedFiles.length} ITEM{receivedFiles.length !== 1 ? "S" : ""}
                                        </span>
                                    </div>

                                    <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar" ref={listRef}>
                                        {receivedFiles.map((file, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-1.5 rounded border border-gray-700 hover:border-accent/30 transition-colors"
                                            >
                                                <div className="flex items-center truncate w-full">
                                                    <FiFile className="text-accent mr-1.5 min-w-[14px] text-sm" />
                                                    <div className="truncate text-left">
                                                        <p className="text-white truncate text-xs">{file.name}</p>
                                                        <p className="text-2xs text-gray-400">
                                                            {formatFileSize(file.size)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}