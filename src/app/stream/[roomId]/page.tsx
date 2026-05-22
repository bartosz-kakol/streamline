"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Box, Button, Typography, Paper, Snackbar, Alert, AlertColor, List, ListItem, ListItemText, ListItemAvatar, Avatar, Backdrop, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import { supabase } from "../../../lib/supabase";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import StopIcon from "@mui/icons-material/Stop";
import PersonIcon from "@mui/icons-material/Person";
import TuneIcon from "@mui/icons-material/Tune";
import SecurityIcon from "@mui/icons-material/Security";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import PrepareStreamDialog from "../../../components/PrepareStreamDialog";

export default function StreamerPanel() {
    const params = useParams();
    const roomId = params.roomId as string;
    const { t } = useTranslation();
    const [permissionsState, setPermissionsState] = useState<boolean | null>(null);
  
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [viewers, setViewers] = useState<any[]>([]);
    const [isLive, setIsLive] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: AlertColor }>({ open: false, message: "", severity: "success" });
  
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const channelRef = useRef<any>(null);

    const showToast = (message: string, severity: AlertColor = "success") => {
        setToast({ open: true, message, severity });
    };

    useEffect(() => {
        const mounted = true;

        const checkPermissions = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

                stream.getTracks().forEach(track => track.stop());

                if (mounted) {
                    setPermissionsState(false);
                }
            } catch {
                if (mounted) {
                    setPermissionsState(true);
                    setToast({ open: true, message: t("panel.limitedFunctionality"), severity: "warning" });
                }
            }
        };

        checkPermissions();

        const channel = supabase.channel(`room-${roomId}`);
        channelRef.current = channel;

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState();
                const currentViewers = Object.keys(state)
                    .filter((key) => !(state[key][0] as any)?.isStreamer)
                    .map((key) => ({ id: key, ...(state[key][0] as any) }));
                
                setViewers(currentViewers);
            })
            .on("broadcast", { event: "webrtc_signaling" }, async (event) => {
                const { type, sender, data } = event.payload;

                if (sender === "streamer") return;

                if (type === "viewer_joined") {
                    if (!stream) return;
          
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
                    });
                    peerConnections.current[sender] = pc;

                    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                    pc.onicecandidate = (e) => {
                        if (e.candidate) {
                            channel.send({
                                type: "broadcast",
                                event: "webrtc_signaling",
                                payload: { type: "ice_candidate", sender: "streamer", target: sender, data: e.candidate },
                            });
                        }
                    };

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
          
                    channel.send({
                        type: "broadcast",
                        event: "webrtc_signaling",
                        payload: { type: "offer", sender: "streamer", target: sender, data: offer },
                    });
                }

                if (type === "answer" && event.payload.target === "streamer") {
                    const pc = peerConnections.current[sender];

                    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
                }

                if (type === "ice_candidate" && event.payload.target === "streamer") {
                    const pc = peerConnections.current[sender];

                    if (pc) await pc.addIceCandidate(new RTCIceCandidate(data));
                }
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ isStreamer: true, joinedAt: new Date().toISOString() });
                }
            });

        return () => {
            channel.unsubscribe();
            Object.values(peerConnections.current).forEach((pc) => pc.close());
        };
    }, [roomId, stream]);

    const handleOpenSetup = () => {
        setSetupOpen(true);
    };

    const onStreamReady = (mediaStream: MediaStream) => {
        setSetupOpen(false);
        setStream(mediaStream);
        setIsLive(true);

        if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
        }

        mediaStream.getVideoTracks()[0].onended = () => {
            handleStopStream();
        };
    
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "webrtc_signaling",
                payload: { type: "stream_started", sender: "streamer" },
            });
        }
    };

    const handleStopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        setStream(null);
        setIsLive(false);

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
    
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "webrtc_signaling",
                payload: { type: "stream_stopped", sender: "streamer" },
            });
        }
    };

    const copyLink = () => {
        const link = `${window.location.origin}/watch/${roomId}`;

        navigator.clipboard.writeText(link);
        showToast(t("panel.copyLink"), "success");
    };

    const handleToastClose = (_event?: unknown, reason?: string | any) => {
        if (reason === "clickaway") return;

        setToast((prev) => ({ ...prev, open: false }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default" }}>
            {/* top bar */}
            <Box sx={{ p: 2, px: 3, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "background.default" }}>
                <Box component="img" src="/logo.png" alt="StreamLine logo" sx={{ height: 40, width: "auto" }} />
                <LanguageSwitcher />
            </Box>

            <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
                {/* viewers list */}
                <Paper elevation={0} sx={{ width: 300, m: 2, mr: 0, borderRadius: "24px", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
                    <Box sx={{ p: 3, pb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                            {t("panel.viewers")} ({viewers.length})
                        </Typography>
                    </Box>
                    <List sx={{ flexGrow: 1, overflowY: "auto" }}>
                        {viewers.map((v) => (
                            <ListItem key={v.id}>
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: "primary.main", color: "background.paper" }}>
                                        <PersonIcon />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText primary={`Viewer ${v.id.substring(0, 4)}`} />
                            </ListItem>
                        ))}
                    </List>
                </Paper>

                {/* preview */}
                <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 4, position: "relative" }}>
                    {!isLive && (
                        <Typography variant="h5" color="text.secondary">
                            {t("panel.streamPreviewPlaceholder")}
                        </Typography>
                    )}
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: isLive ? "block" : "none",
                            borderRadius: "24px",
                            boxShadow: isLive ? "0 12px 40px rgba(0,0,0,0.5)" : "none"
                        }}
                    />
                </Box>
            </Box>

            {/* bottom bar */}
            <Paper elevation={0} sx={{ p: 2, px: 3, m: 2, borderRadius: "100px", display: "flex", alignItems: "center", gap: 2, bgcolor: "background.paper" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: isLive ? "#4caf50" : "#f44336" }} />
                    <Typography variant="h6" color="text.secondary">
                        {isLive ? t("panel.isLive") : t("panel.isNotLive")}
                    </Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyLink}>
                    {t("panel.copyLink")}
                </Button>
                {!isLive ? (
                    <Button variant="contained" color="primary" startIcon={<TuneIcon />} onClick={handleOpenSetup} disabled={permissionsState === null}>
                        {t("panel.prepare")}
                    </Button>
                ) : (
                    <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={handleStopStream}>
                        {t("panel.stop")}
                    </Button>
                )}
            </Paper>

            <PrepareStreamDialog 
                open={setupOpen} 
                permissionsDenied={permissionsState ?? true} 
                onClose={() => setSetupOpen(false)} 
                onGoLive={onStreamReady} 
            />

            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={handleToastClose}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
            >
                <Alert
                    onClose={handleToastClose}
                    severity={toast.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>

            <Backdrop open={permissionsState === null}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <CircularProgress color="inherit" />
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                        <SecurityIcon />
                        <Typography variant="h6">{t("panel.checkingPermissions")}</Typography>
                    </Box>
                </Box>
            </Backdrop>
        </Box>
    );
}
