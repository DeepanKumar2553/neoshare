import { Frame } from "@/ui/frame"
import { twMerge } from "tailwind-merge"
import { Button } from '@/ui/button'
import '../App.css'
import { WifiConnectionUI } from "@/ui/WifiConnectionUI"
import { useEffect, useState } from "react"
import { Input } from "@/ui/input";
import { useNavigate } from "react-router-dom"
import { useSocket } from '../hooks/useSocket'
import { showError } from "@/hooks/useToast"
import { grantReceiverAccess } from "@/store/accessSlice"
import { useDispatch } from "react-redux"

const EnterCode = () => {

    const [isWaiting, setIsWaiting] = useState(false);
    const [codeInput, setCodeInput] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleJoined = (data: { title: string, description?: string }) => {
            dispatch(grantReceiverAccess());
            navigate("/receiver-page");
            showError(data.title, data.description)
        };

        const handleError = (data: { title: string, description?: string }) => {
            showError(data.title, data.description)
            setIsWaiting(false);
        };

        socket.on("joined", handleJoined);
        socket.on("error", handleError);

        const handleRoomDestroyed = () => {
            setIsWaiting(false);
        };

        socket.on("room-destroyed", handleRoomDestroyed);
        return () => {
            socket.off("joined", handleJoined);
            socket.off("error", handleError);
            socket.off("room-destroyed", handleRoomDestroyed);
        };
    }, [socket, navigate, dispatch]);

    const handleJoin = () => {
        if (isWaiting || !codeInput || !socket) return;

        setIsWaiting(true);
        setError("");
        socket.emit("join", codeInput.trim());
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
                    <div className="generate-item wifi-symbol">
                        <WifiConnectionUI
                            isWaiting={isWaiting}
                        />
                    </div>
                    <div className="generate-item">
                        <Input
                            type="text"
                            placeholder="Enter Code"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                            disabled={isWaiting}
                        />
                        {error && <div className="text-red-500 mt-2">{error}</div>}
                    </div>
                    <div className="generate-item">
                        <Button
                            variant={isWaiting ? "default" : "destructive"}
                            shape="default"
                            className="ml-5.5 w-60 transition-all text-base"
                            onClick={handleJoin}
                            disabled={isWaiting}
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
                                "JOIN ROOM"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EnterCode