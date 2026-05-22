"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Box, Button, Typography, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import { supabase } from "../../../lib/supabase";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import { v4 as uuidv4 } from "uuid";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

export default function WatcherPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const { t } = useTranslation();
    const router = useRouter();

    const [hasStarted, setHasStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [shouldConnect, setShouldConnect] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const visitorIdRef = useRef<string>("");

    useEffect(() => {
        let vid = localStorage.getItem("visitor_id");

        if (!vid) {
            vid = uuidv4();
            localStorage.setItem("visitor_id", vid);
        }
        
        visitorIdRef.current = vid;
    }, []);

    useEffect(() => {
        if (!shouldConnect) return;

        const channel = supabase.channel(`room-${roomId}`);

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        pc.ontrack = (event) => {
            if (videoRef.current && event.streams[0]) {
                videoRef.current.srcObject = event.streams[0];
                setHasStarted(true);
            }
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                channel.send({
                    type: "broadcast",
                    event: "webrtc_signaling",
                    payload: { type: "ice_candidate", sender: visitorIdRef.current, target: "streamer", data: e.candidate },
                });
            }
        };

        channel
            .on("broadcast", { event: "webrtc_signaling" }, async (event) => {
                const { type, sender, target, data } = event.payload;

                if (sender === visitorIdRef.current) return;

                if (type === "stream_started") {
                    channel.send({
                        type: "broadcast",
                        event: "webrtc_signaling",
                        payload: { type: "viewer_joined", sender: visitorIdRef.current },
                    });
                }

                if (type === "stream_stopped") {
                    if (videoRef.current) {
                        videoRef.current.srcObject = null;
                    }
                    setHasStarted(false);
                    setIsPlaying(false);
                }

                if (target !== visitorIdRef.current) return;

                if (type === "offer") {
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
          
                    channel.send({
                        type: "broadcast",
                        event: "webrtc_signaling",
                        payload: { type: "answer", sender: visitorIdRef.current, target: "streamer", data: answer },
                    });
                }

                if (type === "ice_candidate") {
                    await pc.addIceCandidate(new RTCIceCandidate(data));
                }
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ isStreamer: false, joinedAt: new Date().toISOString() });
          
                    channel.send({
                        type: "broadcast",
                        event: "webrtc_signaling",
                        payload: { type: "viewer_joined", sender: visitorIdRef.current },
                    });
                }
            });

        return () => {
            channel.unsubscribe();
            pc.close();
        };
    }, [roomId, shouldConnect]);

    const handleStartWatching = () => {
        setShouldConnect(true);
    };

    const handlePlay = () => {
        if (videoRef.current) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
        }
    };

    useEffect(() => {
        if (hasStarted && shouldConnect && !isPlaying) {
            handlePlay();
        }
    }, [hasStarted, shouldConnect, isPlaying]);

    return (
        <Box sx={{ height: "100vh", bgcolor: "#000", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, p: 2, display: "flex", justifyContent: "space-between", zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)", opacity: isPlaying ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isPlaying ? "none" : "auto" }}>
                <Box component="img" src="/logo.png" alt="StreamLine logo" sx={{ cursor: "pointer", height: 40, width: "auto" }} onClick={() => router.push("/")} />
                <LanguageSwitcher />
            </Box>

            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                <video
                    ref={videoRef}
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: hasStarted && shouldConnect ? "block" : "none" }}
                />

                {!shouldConnect && (
                    <Box sx={{ textAlign: "center", color: "white" }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleStartWatching}
                            startIcon={<PlayArrowIcon />}
                            sx={{ py: 2, px: 4, borderRadius: "50px", fontSize: "1.2rem" }}
                        >
                            {t("watch.watchStream")}
                        </Button>
                    </Box>
                )}

                {shouldConnect && !hasStarted && (
                    <Box sx={{ textAlign: "center", color: "white" }}>
                        <CircularProgress color="primary" sx={{ mb: 3 }} />
                        <Typography variant="h5" color="text.secondary">
                            {t("watch.waiting")}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
