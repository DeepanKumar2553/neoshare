import { useSocket } from "@/hooks/useSocket";
import { showError } from "@/hooks/useToast";
import { revokeSenderAccess } from "@/store/accessSlice";
import { useAppDispatch } from "@/store/hooks";
import { triggerReconnect } from "@/store/socketSlice";
import { Frame } from "@/ui/frame";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { FiUpload, FiFile, FiTrash2, FiWifi } from "react-icons/fi";
import { Button } from "@/ui/button";

export default function Sender() {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingIceCandidates = useRef<any[]>([]);
  const isAnswerReceived = useRef(false);

  const fileQueueRef = useRef<File[]>([]);
  const isSendingRef = useRef(false);
  const currentFileRef = useRef<File | null>(null);
  const currentFileIdRef = useRef<string | null>(null);

  const [transferStatus, setTransferStatus] = useState("idle");
  const [transferProgress, setTransferProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const [selectedFilesLength, setSelectedFilesLength] = useState(0);
  const [isRTCConnected, setIsRTCConnected] = useState(false);
  const [uiState, setUiState] = useState<"idle" | "sending" | "">("idle");

  const MAX_BUFFER = 1 * 1024 * 1024; // 2MB safety threshold

  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadSpeedUnit, setUploadSpeedUnit] = useState("KB/s");
  const bytesSentRef = useRef(0);

  useEffect(() => {
    console.log("Sender page mounted");

    const handleRoomDestroyed = (data: { title: string, description?: string }) => {
      navigate('/generate', { replace: true });
      showError(data.title, data.description)
    };

    if (socket) {
      socket.on("room-destroyed", handleRoomDestroyed);
    }

    return () => {
      console.log("Sender page unmounted");

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

      dispatch(triggerReconnect())
      dispatch(revokeSenderAccess());
    }
  }, [dispatch, socket, navigate]);

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  function handleSendRequest() {
    setUiState("sending");
    if (channelRef.current && channelRef.current.readyState === "open") {
      fileQueueRef.current = [...selectedFiles];
      isSendingRef.current = true;

      channelRef.current.send(JSON.stringify({
        type: "REQUEST_PERMISSION",
        fileCount: selectedFiles.length
      }));

      setSelectedFilesLength(selectedFiles.length)
      setSelectedFiles([])
      console.log("Request sent to receiver for permission");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { title: "Connection Error", description: "DataChannel not ready" };
      showError(data.title, data.description);
      console.log(data.description);
    }
  }

  useEffect(() => {
    if (!socket) return;

    const processFileQueue = async () => {
      console.log("Starting to process file queue");
      setTransferStatus("Starting transfer...");

      for (let i = 0; i < fileQueueRef.current.length; i++) {
        const file = fileQueueRef.current[i];
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        currentFileIdRef.current = fileId;
        currentFileRef.current = file;

        setCurrentFileIndex(i + 1);
        setTransferStatus(`Sending ${file.name}...`);

        await sendFileChunks(file, fileId);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log("All files transferred successfully");
      setTransferStatus("Transfer complete");
      setTransferProgress(100);

      setTimeout(() => {
        setTransferStatus("idle");
        setUiState("idle")
        setTransferProgress(0);
        setCurrentFileIndex(0);
      }, 2000);

      isSendingRef.current = false;
    };

    const sendFileChunks = async (file: File, fileId: string) => {
      if (!channelRef.current || channelRef.current.readyState !== "open") {
        console.error("Channel not ready for sending file chunks");
        return;
      }

      try {
        const metadata = {
          type: "FILE_META",
          fileId,
          name: file.name,
          size: file.size,
          typed: file.type
        };
        channelRef.current.send(JSON.stringify(metadata));

        const CHUNK_SIZE = 256 * 1024; // 256KB
        let offset = 0;

        while (offset < file.size) {
          const chunk = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await chunk.arrayBuffer();

          if (channelRef.current.readyState !== "open") {
            throw new Error("Data channel closed during transfer");
          }

          if (channelRef.current.bufferedAmount > MAX_BUFFER) {
            await new Promise<void>((resolve) => {
              channelRef.current!.onbufferedamountlow = () => {
                channelRef.current!.onbufferedamountlow = null;
                resolve();
              };
            });
          }

          channelRef.current.send(buffer);
          bytesSentRef.current += buffer.byteLength;

          offset += buffer.byteLength;

          const progress = Math.round((offset / file.size) * 100);
          setTransferProgress(progress);
        }

        const endData = { type: "FILE_END", fileId, success: true };
        channelRef.current.send(JSON.stringify(endData));
      } catch (error) {
        console.error("Error sending file:", error);
        if (channelRef.current?.readyState === "open") {
          channelRef.current.send(
            JSON.stringify({ type: "FILE_END", fileId, success: false })
          );
        }
      }
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

      const channel = pc.createDataChannel("fileChannel");
      channelRef.current = channel;

      channel.onopen = () => {
        console.log("DataChannel open - ready to send files");
        setIsRTCConnected(true);
      };

      channel.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "PERMISSION_GRANTED") {
          console.log("Receiver accepted, start sending files...");
          setUiState("")
          processFileQueue();
        }

        if (msg.type === "PERMISSION_DENIED") {
          console.log("Receiver denied transfer.");
        }
      };

      channel.onclose = () => {
        console.log("DataChannel closed");
        setIsRTCConnected(false);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (isAnswerReceived.current && socket) {
            console.log("Sending ICE candidate to receiver");
            socket.emit("signal", {
              type: "ice",
              candidate: event.candidate
            });
          } else {
            console.log("Queuing ICE candidate (answer not received)");
            pendingIceCandidates.current.push(event.candidate);
          }
        }
      };

      try {
        if (!socket) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("signal", {
          type: "offer",
          sdp: offer.sdp
        });
        console.log("Offer SDP sent to receiver");
      } catch (error) {
        console.error("Error creating offer:", error);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const answerHandler = async (message: any) => {
        if (message.type === "answer") {
          console.log("Received answer from receiver");
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: "answer",
              sdp: message.sdp
            })
          );

          isAnswerReceived.current = true;

          while (pendingIceCandidates.current.length > 0) {
            const candidate = pendingIceCandidates.current.shift();
            if (socket) {
              console.log("Sending queued ICE candidate to receiver");
              socket.emit("signal", {
                type: "ice",
                candidate
              });
            }
          }

          if (!socket) return;
          socket.off("signal", answerHandler);
        }
      };

      if (!socket) return;

      socket.on("signal", answerHandler);

      socket.on("signal", async (message) => {
        if (message.type === "ice") {
          console.log("Received ICE candidate from receiver");
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
      isAnswerReceived.current = false;
      pendingIceCandidates.current = [];
      isSendingRef.current = false;
      fileQueueRef.current = [];
    };
  }, [MAX_BUFFER, socket]);

  useEffect(() => {
    let lastBytes = 0;
    let lastTime = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000; // seconds
      const delta = bytesSentRef.current - lastBytes;

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

        setUploadSpeed(parseFloat(speed.toFixed(2)));
        setUploadSpeedUnit(unit);
      }

      lastBytes = bytesSentRef.current;
      lastTime = now;
    }, 500);

    return () => clearInterval(interval);
  }, []);



  return (
    <div className="sender-container">
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
            '[{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-1-stroke)","fill":"var(--color-frame-1-fill)"},"path":[["M","37","12"],["L","0% + 59","12"],["L","0% + 85","0% + 33"],["L","79","0% + 12"],["L","50% - 3","12"],["L","50% + 16","30"],["L","100% - 35","30"],["L","100% - 16","47"],["L","100% - 16","100% - 47.05882352941177%"],["L","100% - 8","100% - 44.85294117647059%"],["L","100% - 9","100% - 16.666666666666668%"],["L","100% - 17","100% - 14.705882352941176%"],["L","100% - 17","100% - 30"],["L","100% - 34","100% - 12"],["L","50% + 13","100% - 12"],["L","50% + 15","100% - 26"],["L","50% - 11","100% - 12"],["L","37","100% - 12"],["L","19","100% - 30"],["L","19","0% + 50.490196078431374%"],["L","10","0% + 48.529411764705884%"],["L","10","0% + 20.098039215686274%"],["L","0% + 19.000000000000004","0% + 18.38235294117647%"],["L","19","29"],["L","37","12"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-2-stroke)","fill":"var(--color-frame-2-fill)"},"path":[["M","50% + 10","15"],["L","50% + 19","15"],["L","50% + 24","0% + 20"],["L","50% + 16","0% + 20"],["L","50% + 10","15"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-3-stroke)","fill":"var(--color-frame-3-fill)"},"path":[["M","50% + 25","15"],["L","50% + 34","15"],["L","50% + 40","0% + 21"],["L","50% + 31","0% + 21"],["L","50% + 25","15"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-4-stroke)","fill":"var(--color-frame-4-fill)"},"path":[["M","50% + 40","15"],["L","50% + 52","15"],["L","50% + 61","0% + 23"],["L","50% + 49","0% + 23"],["L","50% + 40","15"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-5-stroke)","fill":"var(--color-frame-5-fill)"},"path":[["M","36","3"],["L","0% + 58","0"],["L","0% + 84","0% + 40"],["L","81","0% + 0"],["L","50% - 1","4"],["L","50% + 5","6"],["L","50% + 54","7"],["L","50% + 74","23"],["L","100% - 32","21"],["L","100% - 8","42"],["L","100% - 9","100% - 52.450980392156865%"],["L","100% + 0","100% - 50.245098039215684%"],["L","100% + 0","100% - 15.196078431372548%"],["L","100% - 7","100% - 13.480392156862745%"],["L","100% - 7","100% - 27"],["L","100% - 29","100% - 3"],["L","50% + 14","100% + 0"],["L","50% + 21","100% - 31"],["L","50% - 13","100% + 0"],["L","37","100% - 4"],["L","11","100% - 28"],["L","10","0% + 55.3921568627451%"],["L","0","0% + 52.94117647058823%"],["L","1","0% + 18.627450980392158%"],["L","11","0% + 16.666666666666668%"],["L","11","25"],["L","36","3"]]}]'
          )}
        />
        {/* Sender Interface Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6 z-10 p-3 overflow-hidden">
          {/* File Upload Area */}
          {uiState === "idle" && isRTCConnected ? (<><div
            className={twMerge(
              "w-64 h-40 flex items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all duration-300 mb-3",
              isDragging
                ? "border-accent"
                : "border-primary/30"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <FiUpload className="text-2xl text-accent mx-auto" />
              <p className="text-gray-300 text-sm font-medium mb-2">
                DRAG & DROP FILES
              </p>

              <Button
                variant="accent"
                className="px-4 py-1.5 text-sm font-medium"
                onClick={handleOpenFileDialog}
              >
                <FiFile className="mr-1" />
                SELECT
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                className="hidden" />
              <p className="text-gray-300 text-sm font-medium mb-2 m-2">
                SUPPORTED FORMATS: ALL
              </p>
              <p className="mt-1 text-xs text-gray-400">Peers must match categories</p>
            </div>
          </div><p className="mt-1 text-xs text-gray-400">Each file must be ≤ half of the receiver’s RAM.</p></>
          ) : uiState !== "sending" && !isRTCConnected ?
            (<>
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2 bg-yellow-500/20 border border-yellow-500 animate-pulse">
                  <FiWifi className="text-3xl text-yellow-500" />
                </div>
                <p className="text-yellow-500 font-medium">Awaiting Secure Connection....</p>
              </div>
              <div className="text-center text-xs text-gray-400">
                <p>Awating connection established</p>
                <p className="mt-1">Data transfer protocol: No Encrypted</p>
                <p className="mt-1">Peers must match categories</p>
              </div>
            </>) : null
          }

          {uiState === "sending" && (
            <div>
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2 bg-yellow-500/20 border border-yellow-500 animate-pulse">
                  <FiWifi className="text-3xl text-yellow-500" />
                </div>
                <p className="text-yellow-500 font-medium">Waiting for Receiver....</p>
              </div>
              <div className="text-center text-xs text-gray-400">
                <p>Secure connection established</p>
                <p className="mt-1">Data transfer protocol: No Encrypted</p>
                <p className="mt-1">Peers must match categories</p>
              </div>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="w-full max-w-xs rounded-xl p-3 bg-gray-900/30">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold text-white">SELECTED FILES</h2>
                <span className="text-accent font-mono text-xs">
                  {selectedFiles.length} ITEM{selectedFiles.length !== 1 ? "S" : ""}
                </span>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-1.5 rounded border border-gray-700 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-center truncate w-10/12">
                      <FiFile className="text-accent mr-1.5 min-w-[14px] text-sm" />
                      <div className="truncate text-left">
                        <p className="text-white truncate text-xs">{file.name}</p>
                        <p className="text-2xs text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2 mt-2">
                <Button
                  variant="accent"
                  className="px-3 py-0.5 text-xs font-medium"
                  onClick={() => setSelectedFiles([])}
                >
                  CLEAR
                </Button>

                <Button
                  variant="default"
                  className="px-3 py-0.5 text-xs font-medium"
                  disabled={selectedFiles.length === 0}
                  onClick={handleSendRequest}
                >
                  SEND
                </Button>
              </div>
            </div>
          )}

          {/* Transfer Status */}
          {transferStatus !== "idle" && (
            <div className="w-full max-w-xs rounded-xl p-3 bg-gray-900/30 mt-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold text-white">TRANSFER STATUS</h2>
                <span className="text-accent font-mono text-xs">
                  {currentFileIndex}/{selectedFilesLength}
                </span>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-accent h-2 rounded-full"
                  style={{ width: `${transferProgress}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-300 truncate">{transferStatus}</p>
                <span className="text-xs text-accent ml-2">
                  {uploadSpeed} {uploadSpeedUnit}
                </span>
              </div>

              <div className="text-right text-xs text-gray-400 mt-1">
                <span className="text-accent">{transferProgress}%</span> Complete
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
