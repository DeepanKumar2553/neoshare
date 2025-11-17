import { Frame } from "@/ui/frame"
import { Textarea } from "@/ui/textarea"
import { twMerge } from "tailwind-merge"
import { Button } from '@/ui/button'
import '../App.css'
import { WifiConnectionUI } from "@/ui/WifiConnectionUI"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSocket } from '../hooks/useSocket'
import { showError } from "@/hooks/useToast"
import { useDispatch } from "react-redux"
import { grantSenderAccess } from "@/store/accessSlice"
import { setRoomCode, setRole } from "@/store/roomSlice"

const GenerateCode = () => {
  const [isWaiting, setIsWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textToDisplay, setTextToDisplay] = useState("");
  const textRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { socket, isConnecting } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleCode = (code: string) => {
      setTextToDisplay(code);
      setIsWaiting(true);

      dispatch(setRoomCode(code));
      dispatch(setRole('sender'));
    };

    const handlePeerJoined = (data: { title: string, description?: string }) => {
      dispatch(grantSenderAccess());
      navigate("/sender-page");
      showError(data.title, data.description)
    };

    socket.on("code", handleCode);
    socket.on("peer-joined", handlePeerJoined);


    const handleRoomDestroyed = () => {
      setIsWaiting(false);
      setTextToDisplay("");
    };

    socket.on("room-destroyed", handleRoomDestroyed);
    return () => {
      socket.off("code", handleCode);
      socket.off("peer-joined", handlePeerJoined);
      socket.off("room-destroyed", handleRoomDestroyed);
    };
  }, [socket, navigate, dispatch]);

  const handleGenerate = useCallback(() => {
    if (isWaiting || !socket) return;
    socket.emit("generate");
  }, [isWaiting, socket]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isWaiting && !isConnecting) {
        handleGenerate();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isWaiting, isConnecting, handleGenerate]);

  const handleCopy = () => {
    if (textRef.current) {
      navigator.clipboard.writeText(textRef.current.textContent || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="generate-container">
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
        <div className="generate-items">
          <div className="generate-item">
            <WifiConnectionUI
              isWaiting={isWaiting}
            />
          </div>
          <div className="generate-item">
            <Textarea>
              <div ref={textRef}>{textToDisplay}</div>
            </Textarea>
            <Button
              variant="default"
              shape="flat"
              className=""
              onClick={handleCopy}
            >
              {/* Sci-Fi Copy Icon */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-cyan-400 transition-all"
              >
                {/* Holographic effect */}
                {copied ? (
                  <path
                    d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z"
                    fill="currentColor"
                    className="text-green-400"
                  />
                ) : (
                  <>
                    <path
                      d="M19 21H8V7H19M19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1Z"
                      fill="currentColor"
                    />
                    {/* Glow effect */}
                    <path
                      d="M19 21H8V7H19M19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1Z"
                      fill="currentColor"
                      className="opacity-20 blur-[2px]"
                    />
                  </>
                )}
              </svg>
            </Button>
          </div>
          <div className="generate-item">
            <Button
              variant={isWaiting ? "default" : "destructive"}
              shape="default"
              className="ml-9 w-60 transition-all"
              onClick={handleGenerate}
              disabled={isWaiting || isConnecting}
            >
              {isWaiting ? (
                <span className="flex items-center justify-center">
                  <span>CONNECTING</span>
                  <span className="ml-2 flex space-x-1">
                    {[...Array(3)].map((_, i) => (
                      <span
                        key={i}
                        className="inline-block w-1.5 h-1.5 bg-current rounded-full"
                        style={{
                          animation: `pulse 1.5s infinite ${i * 0.3}s`
                        }}
                      />
                    ))}
                  </span>
                </span>
              ) : (
                "GENERATE CODE"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GenerateCode